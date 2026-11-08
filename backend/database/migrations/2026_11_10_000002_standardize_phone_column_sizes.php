<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Every phone column becomes string(16) (a canonical 09XXXXXXXXX is 11 characters; +639XXXXXXXXX is 13).
 *
 *   users.contact_no                varchar(255)  -> varchar(16)
 *   patients.guardian_contact       varchar(50)   -> varchar(16)
 *   patients.emergency_contact_no   varchar(50)   -> varchar(16)
 *   patients.emergency_alt_contact  varchar(50)   -> varchar(16)
 *   patients.emergency_contact      text          -> varchar(16)
 *
 * Nothing is changed if a stored value is longer than 16 characters (it would be cut off or the
 * change refused): the migration stops and lists them. Run 2026_11_10_000001 (normalize) first.
 * Columns stay nullable.
 */
return new class extends Migration
{
    private const COLUMNS = [
        'users'    => ['contact_no'],
        'patients' => ['guardian_contact', 'emergency_contact_no', 'emergency_alt_contact', 'emergency_contact'],
    ];

    private const LENGTH = 16;

    public function up(): void
    {
        $tooLong = [];

        foreach (self::COLUMNS as $table => $columns) {
            foreach ($columns as $column) {
                if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
                    continue;
                }

                DB::table($table)->whereNotNull($column)->whereRaw("CHAR_LENGTH(`{$column}`) > ?", [self::LENGTH])
                    ->orderBy('id')->select(['id', $column])
                    ->each(function ($row) use ($table, $column, &$tooLong) {
                        $tooLong[] = "{$table}.{$column} id {$row->id}: " . json_encode($row->{$column}, JSON_UNESCAPED_UNICODE);
                    });
            }
        }

        if ($tooLong) {
            throw new RuntimeException(
                'These values are longer than ' . self::LENGTH . " characters, so the columns cannot be shrunk yet:\n  "
                . implode("\n  ", $tooLong)
                . "\nRun the normalize migration (2026_11_10_000001) or correct them by hand, then run this migration again. Nothing was changed."
            );
        }

        foreach (self::COLUMNS as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $t) use ($table, $columns) {
                foreach ($columns as $column) {
                    if (Schema::hasColumn($table, $column)) {
                        $t->string($column, self::LENGTH)->nullable()->change();
                    }
                }
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('contact_no', 255)->nullable()->change();
        });

        Schema::table('patients', function (Blueprint $t) {
            $t->string('guardian_contact', 50)->nullable()->change();
            $t->string('emergency_contact_no', 50)->nullable()->change();
            $t->string('emergency_alt_contact', 50)->nullable()->change();
            $t->text('emergency_contact')->nullable()->change();
        });
    }
};
