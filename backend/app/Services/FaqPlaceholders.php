<?php

namespace App\Services;

use App\Models\ClinicStaffSchedule;
use App\Models\SystemSetting;
use App\Models\User;
use Carbon\Carbon;

/**
 * Replaces placeholders such as {clinic_hours} in chatbot FAQ answers with the
 * current values from Admin > Clinic Info (system_settings.clinic_info) and
 * Staff Schedules (clinic_staff_schedules).
 *
 * Nothing is cached across requests, so a change in Clinic Info or Staff
 * Schedules shows up in the very next chatbot answer.
 *
 * Empty values never render as blanks: any line that uses a placeholder with
 * no value is replaced by "Please contact the clinic via <hotline> ...".
 */
class FaqPlaceholders
{
    /** token => description (shown in the admin FAQ editor) */
    public const DESCRIPTIONS = [
        'clinic_hours'     => 'Opening and closing time (Clinic Info)',
        'clinic_days'      => 'Days the clinic is open (Clinic Info)',
        'clinic_location'  => 'Building, address and room/landmark (Clinic Info)',
        'clinic_hotline'   => 'Trunkline and mobile hotline (Clinic Info)',
        'clinic_email'     => 'Official clinic email (Clinic Info)',
        'nurse_schedule'   => 'Nurse duty schedule (Staff Schedules)',
        'dentist_schedule' => 'Dentist duty schedule (Staff Schedules)',
    ];

    private const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    /** @var array<string,string> per-instance memo (an instance lives for one request) */
    private array $memo = [];

    private ?array $clinicInfo = null;

    /* ── Public API ────────────────────────────────────────────────────── */

    /**
     * Replace every known {placeholder} in $text.
     * Values are re-read from the database on every call, so a change in
     * Clinic Info / Staff Schedules is visible immediately, even in a
     * long-running worker.
     */
    public function render(?string $text): string
    {
        $this->reset();

        return $this->renderText($text);
    }

    /**
     * Render several answers against ONE read of the data (used by list endpoints
     * so 28 FAQs do not trigger 28 sets of queries).
     *
     * @param  array<int|string,?string>  $texts
     * @return array<int|string,string>
     */
    public function renderMany(array $texts): array
    {
        $this->reset();

        return array_map(fn ($t) => $this->renderText($t), $texts);
    }

    /** Forget values read earlier so the next render sees current data. */
    private function reset(): void
    {
        $this->memo       = [];
        $this->clinicInfo = null;
    }

    private function renderText(?string $text): string
    {
        if ($text === null || $text === '') {
            return '';
        }

        $pattern      = $this->pattern();
        $fallback     = $this->fallbackLine();
        $fallbackUsed = false;
        $out          = [];

        foreach (explode("\n", str_replace("\r\n", "\n", $text)) as $line) {
            if (!preg_match_all($pattern, $line, $found)) {
                $out[] = $line;
                continue;
            }

            $hasEmpty = false;
            foreach (array_unique($found[1]) as $key) {
                if ($this->value($key) === '') {
                    $hasEmpty = true;
                    break;
                }
            }

            if ($hasEmpty) {
                // A line with a missing value becomes one "contact the clinic" line
                // (shown once per answer) instead of a blank.
                if (!$fallbackUsed) {
                    $out[]        = $fallback;
                    $fallbackUsed = true;
                }
                continue;
            }

            $out[] = preg_replace_callback($pattern, fn ($m) => $this->value($m[1]), $line);
        }

        return implode("\n", $out);
    }

    /** Placeholder-looking tokens in $text that are not supported, e.g. a typo like {clinic_hour}. */
    public function unknownTokens(string $text): array
    {
        preg_match_all('/\{([a-z][a-z0-9_]*)\}/', $text, $m);

        return array_values(array_map(
            fn ($k) => '{' . $k . '}',
            array_diff(array_unique($m[1]), array_keys(self::DESCRIPTIONS))
        ));
    }

    /** ['{clinic_hours}', ...] */
    public function tokens(): array
    {
        return array_map(fn ($k) => '{' . $k . '}', array_keys(self::DESCRIPTIONS));
    }

    /** Token list with the current value of each, for the admin editor. */
    public function catalog(): array
    {
        $this->reset();
        $list = [];
        foreach (self::DESCRIPTIONS as $key => $description) {
            $list[] = [
                'token'       => '{' . $key . '}',
                'description' => $description,
                'value'       => $this->value($key),
            ];
        }

        return $list;
    }

    /** Current value of one placeholder ('' when the source data is missing). Memoized within one render call. */
    private function value(string $key): string
    {
        if (!array_key_exists($key, $this->memo)) {
            $this->memo[$key] = match ($key) {
                'clinic_days'      => $this->clinicDays(),
                'clinic_hours'     => $this->clinicHours(),
                'clinic_location'  => $this->clinicLocation(),
                'clinic_hotline'   => $this->clinicHotline(),
                'clinic_email'     => trim((string) ($this->info()['contact_email'] ?? '')),
                'nurse_schedule'   => $this->staffSchedule(['clinic_staff', 'nurse']),
                'dentist_schedule' => $this->staffSchedule(['dentist']),
                default            => '',
            };
        }

        return $this->memo[$key];
    }

    /* ── Clinic Info ───────────────────────────────────────────────────── */

    private function info(): array
    {
        if ($this->clinicInfo === null) {
            $decoded          = json_decode((string) SystemSetting::getValue('clinic_info'), true);
            $this->clinicInfo = is_array($decoded) ? $decoded : [];
        }

        return $this->clinicInfo;
    }

    /** @return array<int,string> day index (0 = Monday) => "7:00 AM – 6:00 PM" */
    private function openDays(): array
    {
        $open = [];

        foreach ((array) ($this->info()['schedule'] ?? []) as $row) {
            if (!is_array($row) || empty($row['is_open'])) {
                continue;
            }
            $idx = array_search(strtolower(trim((string) ($row['day'] ?? ''))), self::DAYS, true);
            $from = $this->minutes($row['open_time'] ?? null);
            $to   = $this->minutes($row['close_time'] ?? null);

            if ($idx === false || $from === null || $to === null || $to <= $from) {
                continue;
            }
            $open[$idx] = $this->range($from, $to);
        }

        ksort($open);

        return $open;
    }

    private function clinicDays(): string
    {
        $open = $this->openDays();

        return $open ? $this->dayLabel(array_keys($open)) : '';
    }

    private function clinicHours(): string
    {
        $open = $this->openDays();
        if (!$open) {
            return '';
        }

        $groups = [];
        foreach ($open as $idx => $hours) {
            $groups[$hours][] = $idx;
        }

        if (count($groups) === 1) {
            return (string) array_key_first($groups);
        }

        $parts = [];
        foreach ($groups as $hours => $idxs) {
            $parts[] = $hours . ' (' . $this->dayLabel($idxs) . ')';
        }

        return $this->joinList($parts);
    }

    private function clinicLocation(): string
    {
        $info = $this->info();
        $main = array_filter([
            trim((string) ($info['location_name'] ?? '')),
            trim((string) ($info['location_address'] ?? '')),
        ], fn ($p) => $p !== '');
        $landmark = trim((string) ($info['location_landmark'] ?? ''));

        $text = implode(', ', $main);
        if ($landmark !== '') {
            $text = $text !== '' ? $text . ' (' . $landmark . ')' : $landmark;
        }

        return $text;
    }

    private function clinicHotline(): string
    {
        $info  = $this->info();
        $lines = array_filter([
            trim((string) ($info['contact_trunkline'] ?? '')),
            trim((string) ($info['contact_mobile'] ?? '')),
        ], fn ($p) => $p !== '');

        return implode(' or ', $lines);
    }

    /* ── Staff Schedules ───────────────────────────────────────────────── */

    /** @param string[] $roles users.role values / roles.slug values for this staff type */
    private function staffSchedule(array $roles): string
    {
        $userIds = User::query()
            ->where('is_active', true)
            ->where(function ($q) use ($roles) {
                $q->whereIn('role', $roles)
                  ->orWhereHas('roleRelation', fn ($r) => $r->whereIn('slug', $roles));
            })
            ->pluck('id');

        if ($userIds->isEmpty()) {
            return '';
        }

        // Collect every available block per weekday (several staff of the same role are combined).
        $perDay = [];
        foreach (ClinicStaffSchedule::whereIn('user_id', $userIds)->where('is_available', true)->get() as $row) {
            $idx  = array_search(strtolower(trim((string) $row->day_of_week)), self::DAYS, true);
            $from = $this->minutes($row->start_time);
            $to   = $this->minutes($row->end_time);

            if ($idx === false || $from === null || $to === null || $to <= $from) {
                continue;
            }
            $perDay[$idx][] = [$from, $to];
        }

        if (!$perDay) {
            return '';
        }
        ksort($perDay);

        // Merge overlapping/touching blocks, then group weekdays that have identical hours.
        $groups = [];
        foreach ($perDay as $idx => $blocks) {
            $text = implode(', ', array_map(fn ($b) => $this->range($b[0], $b[1]), $this->mergeBlocks($blocks)));
            $groups[$text][] = $idx;
        }

        $lines = [];
        foreach ($groups as $text => $idxs) {
            $lines[] = $this->dayLabel($idxs) . ': ' . $text;
        }

        return implode("\n", $lines);
    }

    /** @param array<int,array{0:int,1:int}> $blocks */
    private function mergeBlocks(array $blocks): array
    {
        usort($blocks, fn ($a, $b) => $a[0] <=> $b[0]);
        $merged = [];

        foreach ($blocks as $block) {
            $last = count($merged) - 1;
            if ($last >= 0 && $block[0] <= $merged[$last][1]) {
                $merged[$last][1] = max($merged[$last][1], $block[1]);
            } else {
                $merged[] = $block;
            }
        }

        return $merged;
    }

    /* ── Formatting helpers ────────────────────────────────────────────── */

    private function pattern(): string
    {
        return '/\{(' . implode('|', array_keys(self::DESCRIPTIONS)) . ')\}/';
    }

    private function fallbackLine(): string
    {
        $hotline = $this->value('clinic_hotline');

        return $hotline !== ''
            ? "Please contact the clinic via {$hotline} for this information."
            : 'Please contact the clinic for this information.';
    }

    /** "08:00" or "08:00:00" => minutes since midnight, null if invalid. */
    private function minutes($time): ?int
    {
        if (!is_string($time) || !preg_match('/^(\d{1,2}):(\d{2})/', trim($time), $m)) {
            return null;
        }
        $h = (int) $m[1];
        $i = (int) $m[2];

        return ($h > 23 || $i > 59) ? null : $h * 60 + $i;
    }

    private function range(int $from, int $to): string
    {
        return $this->clock($from) . " \u{2013} " . $this->clock($to);
    }

    private function clock(int $minutes): string
    {
        return Carbon::createFromTime(intdiv($minutes, 60), $minutes % 60)->format('g:i A');
    }

    /** [0,1,2,3,5] => "Monday to Thursday and Saturday" */
    private function dayLabel(array $idxs): string
    {
        sort($idxs);
        $runs = [];
        $start = $prev = null;

        foreach ($idxs as $i) {
            if ($start === null) {
                $start = $prev = $i;
            } elseif ($i === $prev + 1) {
                $prev = $i;
            } else {
                $runs[] = [$start, $prev];
                $start  = $prev = $i;
            }
        }
        if ($start !== null) {
            $runs[] = [$start, $prev];
        }

        return $this->joinList(array_map(
            fn ($r) => $r[0] === $r[1]
                ? ucfirst(self::DAYS[$r[0]])
                : ucfirst(self::DAYS[$r[0]]) . ' to ' . ucfirst(self::DAYS[$r[1]]),
            $runs
        ));
    }

    /** ['a','b','c'] => "a, b and c" */
    private function joinList(array $items): string
    {
        $items = array_values($items);
        $n     = count($items);

        if ($n <= 1) {
            return $items[0] ?? '';
        }

        return implode(', ', array_slice($items, 0, $n - 1)) . ' and ' . $items[$n - 1];
    }
}
