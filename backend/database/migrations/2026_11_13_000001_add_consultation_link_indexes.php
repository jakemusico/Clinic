<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes for the consultation/patient-list hot paths: appointment links, complaint
 * categories and the patients.user_id lookup. The earlier performance migration already
 * covers visit dates and patient+date pairs; this adds only what is still missing.
 *
 * Safe on databases that already have some of them: each index is created only when the
 * table and columns exist and no index with that name exists yet.
 */
return new class extends Migration
{
    /** table => [index name => columns] */
    private function indexes(): array
    {
        return [
            'patients' => [
                'idx_patients_user_id' => ['user_id'],
            ],
            'clinic_records' => [
                'idx_clinic_records_appointment' => ['appointment_id'],
                'idx_clinic_records_category'    => ['complaint_category_id'],
            ],
            'dental_consultations' => [
                'idx_dental_consultations_appointment' => ['appointment_id'],
                'idx_dental_consultations_category'    => ['complaint_category_id'],
            ],
            'appointments' => [
                'idx_appointments_status' => ['status'],
            ],
            'complaint_categories' => [
                'idx_complaint_categories_type' => ['type'],
            ],
        ];
    }

    public function up(): void
    {
        foreach ($this->indexes() as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            foreach ($indexes as $name => $columns) {
                if (! Schema::hasColumns($table, $columns) || Schema::hasIndex($table, $name)) {
                    continue;
                }
                Schema::table($table, fn (Blueprint $t) => $t->index($columns, $name));
            }
        }
    }

    public function down(): void
    {
        foreach ($this->indexes() as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            foreach (array_keys($indexes) as $name) {
                if (Schema::hasIndex($table, $name)) {
                    Schema::table($table, fn (Blueprint $t) => $t->dropIndex($name));
                }
            }
        }
    }
};
