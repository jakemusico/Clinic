<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Remove leftover test/junk rows before a demo or deployment:
 *
 *  - announcements with keyboard-mash titles ('zzd', 'WARADAF', ...)
 *  - chatbot_question_logs bulk seed bursts (>50 rows in one second) and
 *    gibberish questions ('zzzqqq xyzzy', ...)
 *  - unprofessional test lines in patients.medical_history
 *  - test chat messages (gibberish / one-word pings)
 *  - duplicate appointments: same patient + service + staff + day booked twice
 *    within an hour of each other (keeps the row that has a consultation)
 *
 *   php artisan db:clean-test-data --dry-run   # show what would be removed
 *   php artisan db:clean-test-data             # apply
 */
class CleanTestData extends Command
{
    protected $signature = 'db:clean-test-data {--dry-run : List what would be removed without changing anything}';

    protected $description = 'Remove test/junk rows (announcements, chatbot logs, chat messages, medical history lines, duplicate appointments)';

    /** Chat bodies that are obviously test typing, matched after normalization. */
    private const JUNK_MESSAGES = [
        'das', 'hi nurse', 'kaon na daghan', 'kaon na', 'agay nurse', 'maam', 'maam?',
        'yes dong', 'nagunsa kamasda', 'halu', 'nang', 'i love you maam nurse',
        'nag sakit imong heart? ayaw kol', 'sa', 'nurse', ',maaa', 'hala okay maam',
        'asa ka', 'juan ali diri', 'juan naay pahgkaon diri',
    ];

    /** Substrings that mark a medical_history line as test typing. */
    private const JUNK_HISTORY_PATTERNS = [
        '/wala ra/i', '/iyang lubot/i', '/sakit\s+iyang/i',
        '/\b(fds|daas+|dfdfd|dsa|sda|asd|qwe|zxc|qwer|asdf|zxcv|test)\b/i',
    ];

    private bool $dryRun = false;

    /** @var array<string, int> section => affected rows */
    private array $results = [];

    public function handle(): int
    {
        $this->dryRun = (bool) $this->option('dry-run');
        if ($this->dryRun) {
            $this->warn('DRY RUN — nothing will be changed.');
        }

        $this->cleanAnnouncements();
        $this->cleanChatbotQuestionLogs();
        $this->cleanMedicalHistories();
        $this->cleanMessages();
        $this->cleanDuplicateAppointments();

        $this->newLine();
        $this->table(['Section', 'Rows affected'], collect($this->results)->map(fn ($n, $s) => [$s, $n])->values()->all());

        return self::SUCCESS;
    }

    // ── Announcements ────────────────────────────────────────────────────

    private function cleanAnnouncements(): void
    {
        $junk = DB::table('announcements')->pluck('title', 'id')
            ->filter(fn ($title) => $this->isJunkTitle((string) $title))
            ->keys();

        $this->deleteIds('announcements', $junk, 'Test announcements');
    }

    private function isJunkTitle(string $title): bool
    {
        $t = strtolower(trim($title));
        if ($t === '') {
            return false;
        }
        if (in_array($t, ['zzd', 'waradaf', 'test', 'testing', 'asdf', 'qwer'], true)) {
            return true;
        }
        // Consonant-only keyboard mash — real titles always contain a vowel.
        return (bool) preg_match('/^[bcdfghjklmnpqrstvwxz]+$/i', $t);
    }

    // ── Chatbot question logs ────────────────────────────────────────────

    private function cleanChatbotQuestionLogs(): void
    {
        // Bulk seed bursts: more than 50 log rows sharing one created_at second.
        $burstTimes = DB::table('chatbot_question_logs')
            ->select('created_at', DB::raw('COUNT(*) AS c'))
            ->groupBy('created_at')
            ->having('c', '>', 50)
            ->pluck('created_at');

        $ids = DB::table('chatbot_question_logs')->whereIn('created_at', $burstTimes)->pluck('id');

        // Gibberish questions anywhere else ('zzzqqq xyzzy', keyboard mash).
        DB::table('chatbot_question_logs')->whereNotIn('id', $ids)->orderBy('id')
            ->chunkById(500, function ($rows) use (&$ids) {
                foreach ($rows as $row) {
                    if ($this->isGibberish((string) $row->question)) {
                        $ids->push($row->id);
                    }
                }
            }, 'id');

        $this->deleteIds('chatbot_question_logs', $ids->unique()->values(), 'Chatbot question logs');
    }

    private function isGibberish(string $text): bool
    {
        $t = trim($text);
        if ($t === '' || mb_strlen($t) < 3) {
            return true;
        }
        // No vowels at all is never a real question.
        return preg_match('/[aeiou]/i', $t) === 0;
    }

    // ── Patient medical history ──────────────────────────────────────────

    private function cleanMedicalHistories(): void
    {
        $changed = 0;

        DB::table('patients')->whereNotNull('medical_history')->orderBy('id')
            ->chunkById(200, function ($patients) use (&$changed) {
                foreach ($patients as $patient) {
                    $lines = preg_split('/\r?\n/', (string) $patient->medical_history);
                    $kept  = array_values(array_filter(array_map('trim', $lines), fn ($l) => $l !== '' && ! $this->isJunkHistoryLine($l)));

                    $new = $kept ? implode("\n", $kept) : 'N/A';
                    if ($new !== $patient->medical_history) {
                        $changed++;
                        if (! $this->dryRun) {
                            DB::table('patients')->where('id', $patient->id)->update(['medical_history' => $new]);
                        }
                    }
                }
            }, 'id');

        $this->results['Patient medical history lines'] = $changed;
    }

    private function isJunkHistoryLine(string $line): bool
    {
        // Strip a leading "[YYYY-MM-DD]" visit tag before judging the text.
        $text = trim((string) preg_replace('/^\[\d{4}-\d{2}-\d{2}\]\s*/', '', $line));
        if ($text === '') {
            return true;
        }
        foreach (self::JUNK_HISTORY_PATTERNS as $pattern) {
            if (preg_match($pattern, $text)) {
                return true;
            }
        }
        // Vowel-less entries are keyboard mash, not medical notes.
        return preg_match('/[aeiou]/i', $text) === 0;
    }

    // ── Chat messages ────────────────────────────────────────────────────

    private function cleanMessages(): void
    {
        $junkNormalized = array_map(
            fn ($m) => $this->normalize((string) $m),
            self::JUNK_MESSAGES
        );

        $ids = collect();
        DB::table('messages')->whereNull('deleted_at')->orderBy('id')
            ->chunkById(500, function ($rows) use (&$ids, $junkNormalized) {
                foreach ($rows as $row) {
                    $norm = $this->normalize((string) $row->body);
                    if ($norm === ''
                        || strlen($norm) <= 2
                        || preg_match('/[aeiou]/', $norm) === 0
                        || in_array($norm, $junkNormalized, true)
                        || (bool) preg_match('/(.)\1{3,}/', $norm)   // 'maaa', 'yaaa'
                        || str_contains($norm, 'asdf') || str_contains($norm, 'qwer') || str_contains($norm, 'zxcv')
                    ) {
                        $ids->push($row->id);
                    }
                }
            }, 'id');

        $this->deleteIds('messages', $ids->unique()->values(), 'Chat messages');
    }

    /** Lowercase letters/digits only, so 'Maam?' and 'maam' compare equal. */
    private function normalize(string $text): string
    {
        return (string) preg_replace('/[^a-z0-9]+/', '', strtolower($text));
    }

    // ── Duplicate appointments ───────────────────────────────────────────

    /**
     * Same patient + service + staff + day booked twice within an hour is a
     * duplicate, not two visits. The keeper is the row that has a consultation,
     * then the most advanced status, then the earliest slot.
     */
    private function cleanDuplicateAppointments(): void
    {
        $appointments = DB::table('appointments')
            ->orderBy('patient_id')->orderBy('service_id')->orderBy('staff_id')->orderBy('scheduled_at')
            ->get(['id', 'patient_id', 'service_id', 'staff_id', 'appointment_type', 'scheduled_at', 'status']);

        $linkedIds = DB::table('clinic_records')->whereNotNull('appointment_id')->pluck('appointment_id')
            ->merge(DB::table('dental_consultations')->whereNotNull('appointment_id')->pluck('appointment_id'))
            ->flip();

        $statusRank = ['completed' => 4, 'confirmed' => 3, 'pending' => 2, 'cancelled' => 1, 'no_show' => 0];

        $groups = $appointments->groupBy(fn ($a) => implode('|', [
            $a->patient_id, $a->service_id, $a->staff_id, $a->appointment_type,
            Carbon::parse($a->scheduled_at)->toDateString(),
        ]));

        $removeIds = [];
        $skipped   = [];

        foreach ($groups as $group) {
            // Cluster rows booked less than 60 minutes apart.
            $clusters = [];
            $current  = [];
            $prevTime = null;
            foreach ($group as $appt) {
                $time = Carbon::parse($appt->scheduled_at);
                if ($prevTime !== null && $time->diffInMinutes($prevTime) >= 60) {
                    $clusters[] = $current;
                    $current    = [];
                }
                $current[] = $appt;
                $prevTime  = $time;
            }
            if ($current) {
                $clusters[] = $current;
            }

            foreach ($clusters as $cluster) {
                if (count($cluster) < 2) {
                    continue;
                }

                usort($cluster, function ($a, $b) use ($linkedIds, $statusRank) {
                    $aLinked = isset($linkedIds[$a->id]) ? 1 : 0;
                    $bLinked = isset($linkedIds[$b->id]) ? 1 : 0;
                    return [$bLinked, $statusRank[$b->status] ?? -1, $a->scheduled_at, $a->id]
                        <=> [$aLinked, $statusRank[$a->status] ?? -1, $b->scheduled_at, $b->id];
                });

                $keeper = array_shift($cluster);
                foreach ($cluster as $dup) {
                    if (isset($linkedIds[$dup->id])) {
                        // Never delete a row a consultation points at.
                        $skipped[] = $dup->id;
                        continue;
                    }
                    $removeIds[] = $dup->id;
                }
            }
        }

        if ($skipped) {
            $this->warn('Skipped duplicate appointments that have consultation records: ' . implode(', ', $skipped));
        }

        $this->deleteIds('appointments', collect($removeIds), 'Duplicate appointments');
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    /** @param \Illuminate\Support\Collection<int, int> $ids */
    private function deleteIds(string $table, $ids, string $label): void
    {
        $ids = $ids->unique()->values();
        $this->results[$label] = $ids->count();

        if ($ids->isEmpty() || $this->dryRun) {
            return;
        }

        DB::table($table)->whereIn('id', $ids)->delete();
        $this->line("  {$label}: deleted {$ids->count()} row(s) from {$table}.");
    }
}
