<?php

namespace App\Console\Commands;

use App\Models\Announcement;
use App\Models\CalendarEvent;
use App\Models\ClinicRecord;
use App\Models\ClinicService;
use App\Models\ClinicStaffSchedule;
use App\Models\ComplaintCategory;
use App\Models\Concerns\NormalizesText;
use App\Models\DentalChartTooth;
use App\Models\DentalConsultation;
use App\Models\InventoryBatch;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Models\Message;
use App\Models\Patient;
use App\Models\Section;
use App\Models\StaffUnavailability;
use App\Models\User;
use App\Support\TextNormalizer;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;

/**
 * One-time backfill: apply the Proper Case / sentence-case rules (see
 * App\Support\TextNormalizer and the NormalizesText trait) to rows that were
 * saved before the rules existed.
 *
 *   php artisan text:normalize-existing --dry-run   # print changes only
 *   php artisan text:normalize-existing             # apply changes
 */
class NormalizeExistingText extends Command
{
    protected $signature = 'text:normalize-existing {--dry-run : Only print what would change}';

    protected $description = 'Normalize casing of existing text fields (Proper Case / sentence case)';

    /** @var class-string<Model&NormalizesText>[] */
    private const MODELS = [
        User::class,
        Patient::class,
        ClinicRecord::class,
        DentalConsultation::class,
        DentalChartTooth::class,
        ClinicStaffSchedule::class,
        StaffUnavailability::class,
        Announcement::class,
        CalendarEvent::class,
        ClinicService::class,
        Section::class,
        ComplaintCategory::class,
        InventoryItem::class,
        InventoryBatch::class,
        InventoryTransaction::class,
        Message::class,
    ];

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        if ($dryRun) {
            $this->warn('DRY RUN — no changes will be saved.');
        }

        $changed = 0;

        foreach (self::MODELS as $class) {
            $map = (new $class)->normalizedTextFields();
            $fields = array_merge($map['proper'] ?? [], $map['sentence'] ?? []);
            if (! $fields) {
                continue;
            }

            $methodFor = [];
            foreach ($map['proper'] ?? [] as $f) {
                $methodFor[$f] = 'properCase';
            }
            foreach ($map['sentence'] ?? [] as $f) {
                $methodFor[$f] = 'sentenceCase';
            }

            $classChanged = 0;
            $class::query()->chunkById(200, function ($rows) use ($methodFor, $dryRun, &$classChanged, $class) {
                foreach ($rows as $row) {
                    $dirty = [];
                    foreach ($methodFor as $field => $method) {
                        if (! array_key_exists($field, $row->getAttributes())) {
                            continue;
                        }
                        $value = $row->getAttribute($field);
                        if (! is_string($value) || trim($value) === '') {
                            continue;
                        }
                        $normalized = TextNormalizer::$method($value);
                        if ($normalized !== $value) {
                            $dirty[$field] = $normalized;
                        }
                    }

                    if (! $dirty) {
                        continue;
                    }

                    $classChanged += count($dirty);
                    $this->line(sprintf(
                        '%s #%d  %s',
                        class_basename($class),
                        $row->getKey(),
                        collect($dirty)->map(fn ($v, $f) => "{$f}: " . $this->preview($row->getAttribute($f)) . ' -> ' . $this->preview($v))->implode(' | ')
                    ));

                    if (! $dryRun) {
                        foreach ($dirty as $field => $normalized) {
                            $row->setAttribute($field, $normalized);
                        }
                        $row->save();
                    }
                }
            });

            if ($classChanged) {
                $this->info(class_basename($class) . ": {$classChanged} field(s)" . ($dryRun ? ' would change' : ' normalized'));
            }
            $changed += $classChanged;
        }

        $this->newLine();
        $this->info($dryRun
            ? "Dry run complete: {$changed} field(s) would be normalized."
            : "Done: {$changed} field(s) normalized.");

        return self::SUCCESS;
    }

    private function preview(string $value): string
    {
        $value = str_replace(["\n", "\r"], ' ', $value);
        return strlen($value) > 80 ? substr($value, 0, 77) . '...' : $value;
    }
}
