<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One consultation per appointment.
 *
 * Adds a unique index on appointment_id to clinic_records and dental_consultations. Rows with no
 * appointment (NULL) are not affected: MySQL/MariaDB allow any number of NULLs in a unique index.
 *
 * The migration NEVER deletes or changes data. If a table already has two consultations for the
 * same appointment it stops with a message that lists them, so you can decide which one to keep.
 * (When this migration was written, a check of the database found no such duplicates.)
 */
return new class extends Migration
{
    /** table => index name */
    private const INDEXES = [
        'clinic_records'       => 'uniq_clinic_records_appointment',
        'dental_consultations' => 'uniq_dental_consultations_appointment',
    ];

    public function up(): void
    {
        // Check everything first, so a problem in the second table leaves the first one untouched.
        foreach (self::INDEXES as $table => $index) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'appointment_id') || Schema::hasIndex($table, $index)) {
                continue;
            }

            $duplicates = DB::table($table)
                ->select('appointment_id', DB::raw('COUNT(*) AS rows_count'), DB::raw('GROUP_CONCAT(id ORDER BY id) AS ids'))
                ->whereNotNull('appointment_id')
                ->groupBy('appointment_id')
                ->having('rows_count', '>', 1)
                ->get();

            if ($duplicates->isNotEmpty()) {
                $list = $duplicates
                    ->map(fn ($d) => "appointment {$d->appointment_id}: {$table} ids {$d->ids}")
                    ->implode('; ');

                throw new RuntimeException(
                    "Cannot add the unique index on {$table}.appointment_id: some appointments already have more than one record ({$list}). "
                    . 'Decide which record to keep (or unlink the others by setting their appointment_id to NULL), then run the migration again. Nothing was changed.'
                );
            }
        }

        foreach (self::INDEXES as $table => $index) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'appointment_id') || Schema::hasIndex($table, $index)) {
                continue;
            }

            Schema::table($table, fn (Blueprint $t) => $t->unique('appointment_id', $index));
        }
    }

    public function down(): void
    {
        foreach (self::INDEXES as $table => $index) {
            if (Schema::hasTable($table) && Schema::hasIndex($table, $index)) {
                Schema::table($table, fn (Blueprint $t) => $t->dropUnique($index));
            }
        }
    }
};
