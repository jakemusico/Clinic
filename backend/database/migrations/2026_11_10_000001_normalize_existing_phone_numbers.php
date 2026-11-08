<?php

use App\Support\PhoneNumber;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Data fix: rewrite every stored phone number to the canonical form 09XXXXXXXXX.
 *
 *   0917-111-2222 -> 09171112222      +63 917 111 2222 -> 09171112222      639171112222 -> 09171112222
 *   '' or spaces only -> NULL (so the unique index on users.contact_no is not blocked by empty strings)
 *
 * Safety:
 *   * ALL-OR-NOTHING. If any value cannot be turned into a valid number, the migration stops BEFORE
 *     writing anything and lists those rows. Fix them by hand (or clear them), then run it again.
 *   * It only changes the format of a number. It never deletes a row and never changes a number to a
 *     different one. It does not look at duplicates (see the add_unique_contact_no migration).
 *   * Before writing, the old and new value of every changed row is saved to
 *     storage/app/backups/phone_numbers_before_normalize_<date>.json, so the change can be undone.
 *   * Values already in the canonical form are not touched.
 *
 * Run it BEFORE 2026_11_10_000002 (column sizes) and 2026_11_10_000003 (unique index).
 */
return new class extends Migration
{
    /** table => columns that hold a phone number */
    private const COLUMNS = [
        'users'    => ['contact_no'],
        'patients' => ['guardian_contact', 'emergency_contact_no', 'emergency_alt_contact', 'emergency_contact'],
    ];

    public function up(): void
    {
        $changes = [];   // [table, column, id, old, new]
        $invalid = [];   // [table, column, id, value]

        foreach (self::COLUMNS as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach ($columns as $column) {
                if (! Schema::hasColumn($table, $column)) {
                    continue;
                }

                DB::table($table)->whereNotNull($column)->orderBy('id')->select(['id', $column])
                    ->each(function ($row) use ($table, $column, &$changes, &$invalid) {
                        $old = $row->{$column};

                        if (PhoneNumber::isBlank($old)) {
                            $changes[] = [$table, $column, $row->id, $old, null];
                            return;
                        }

                        $new = PhoneNumber::normalize($old);

                        if ($new === null) {
                            $invalid[] = [$table, $column, $row->id, $old];
                        } elseif ($new !== $old) {
                            $changes[] = [$table, $column, $row->id, $old, $new];
                        }
                    });
            }
        }

        if ($invalid) {
            $list = collect($invalid)
                ->map(fn ($r) => "{$r[0]}.{$r[1]} id {$r[2]}: " . json_encode($r[3], JSON_UNESCAPED_UNICODE))
                ->implode("\n  ");

            throw new RuntimeException(
                "These phone numbers cannot be converted to 09XXXXXXXXX:\n  {$list}\n"
                . "Correct or clear them (for example from the profile screens), then run the migration again. Nothing was changed."
            );
        }

        if (! $changes) {
            return;
        }

        // Back up what is about to change
        $dir = storage_path('app/backups');
        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $file = $dir . '/phone_numbers_before_normalize_' . date('Ymd_His') . '.json';
        file_put_contents($file, json_encode(
            array_map(fn ($c) => ['table' => $c[0], 'column' => $c[1], 'id' => $c[2], 'old' => $c[3], 'new' => $c[4]], $changes),
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE
        ));

        DB::transaction(function () use ($changes) {
            foreach ($changes as [$table, $column, $id, , $new]) {
                DB::table($table)->where('id', $id)->update([$column => $new]);
            }
        });
    }

    public function down(): void
    {
        // The previous (mixed) formats are in storage/app/backups/phone_numbers_before_normalize_*.json.
        // The canonical numbers are still valid numbers, so there is nothing to undo here.
    }
};
