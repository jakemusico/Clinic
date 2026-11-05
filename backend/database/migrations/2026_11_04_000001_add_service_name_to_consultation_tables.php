<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Consultations never stored the clinic service they were for: the form sent it, but there was no
 * column, so the Service column only worked when an appointment was linked (walk-in consultations
 * showed an empty value). This adds the column and fills it for existing rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['clinic_records', 'dental_consultations'] as $table) {
            if (Schema::hasTable($table) && ! Schema::hasColumn($table, 'service_name')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->string('service_name')->nullable()->after('appointment_id');
                });
            }
        }

        // Existing rows: take the service of the linked appointment (only fills empty values).
        foreach (['clinic_records', 'dental_consultations'] as $table) {
            DB::update(
                "UPDATE {$table}
                    SET service_name = (
                        SELECT s.name FROM appointments a
                        JOIN clinic_services s ON s.id = a.service_id
                        WHERE a.id = {$table}.appointment_id
                    )
                  WHERE service_name IS NULL AND appointment_id IS NOT NULL"
            );
        }

        // Older dental forms copied the chosen service into the diagnosis; use it when it is exactly a service name.
        DB::update(
            'UPDATE dental_consultations
                SET service_name = (SELECT s.name FROM clinic_services s WHERE s.name = dental_consultations.diagnosis LIMIT 1)
              WHERE service_name IS NULL AND diagnosis IN (SELECT name FROM clinic_services)'
        );
    }

    public function down(): void
    {
        foreach (['clinic_records', 'dental_consultations'] as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'service_name')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->dropColumn('service_name');
                });
            }
        }
    }
};
