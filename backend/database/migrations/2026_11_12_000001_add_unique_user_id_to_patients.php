<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One patient profile per user: unique index on patients.user_id.
 *
 * Without it, two requests made at the same moment (for example a first booking and a nurse opening
 * the patient list) could each create a patient row for the same user.
 *
 * This migration NEVER deletes or changes data. If a user already has more than one patient row it
 * stops and lists them (the patient ids, and how many consultations / appointments hang on each),
 * so you can decide which row to keep. Nothing is changed in that case.
 * (When this migration was written, the database had no duplicates.)
 */
return new class extends Migration
{
    private const INDEX = 'patients_user_id_unique';

    public function up(): void
    {
        if (! Schema::hasTable('patients') || Schema::hasIndex('patients', self::INDEX)) {
            return;
        }

        $groups = DB::table('patients')
            ->select('user_id', DB::raw('COUNT(*) AS rows_count'), DB::raw('GROUP_CONCAT(id ORDER BY id) AS ids'))
            ->whereNotNull('user_id')
            ->groupBy('user_id')
            ->having('rows_count', '>', 1)
            ->get();

        if ($groups->isNotEmpty()) {
            $lines = [];
            foreach ($groups as $g) {
                $lines[] = "user #{$g->user_id} has {$g->rows_count} patient rows (ids {$g->ids}):";
                foreach (explode(',', $g->ids) as $patientId) {
                    $records = DB::table('clinic_records')->where('patient_id', $patientId)->count();
                    $dental  = DB::table('dental_consultations')->where('patient_id', $patientId)->count();
                    $appts   = DB::table('appointments')->where('patient_id', $patientId)->count();
                    $lines[] = "    patient #{$patientId}: {$records} medical records, {$dental} dental consultations, {$appts} appointments";
                }
            }

            throw new RuntimeException(
                "Cannot add the unique index on patients.user_id: some users have more than one patient row.\n"
                . implode("\n", $lines)
                . "\nMove the records of the extra rows to the one you keep (or tell me and I will prepare that), then run the migration again. Nothing was changed."
            );
        }

        Schema::table('patients', fn (Blueprint $t) => $t->unique('user_id', self::INDEX));
    }

    public function down(): void
    {
        if (Schema::hasTable('patients') && Schema::hasIndex('patients', self::INDEX)) {
            Schema::table('patients', fn (Blueprint $t) => $t->dropUnique(self::INDEX));
        }
    }
};
