<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Remove schedule rows that sit entirely inside a wider available shift for
     * the same staff member and day — e.g. a leftover 13:00-17:00 afternoon
     * duplicate under an 08:00-17:00 full-day Monday shift. Overlapping slots are
     * rejected by ClinicStaffScheduleController::findOverlap(); this cleans rows
     * written before that validation existed.
     */
    public function up(): void
    {
        $rows = DB::table('clinic_staff_schedules')
            ->orderBy('user_id')
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get();

        $removeIds = [];

        foreach ($rows as $inner) {
            $contained = $rows->contains(function ($outer) use ($inner) {
                // TIME columns compare correctly as 'H:i:s' strings.
                return $outer->id !== $inner->id
                    && $outer->user_id === $inner->user_id
                    && $outer->day_of_week === $inner->day_of_week
                    && (int) $outer->is_available === 1
                    && $outer->start_time <= $inner->start_time
                    && $outer->end_time >= $inner->end_time
                    // strictly contained — identical rows are already blocked by uniq_staff_schedule_slot
                    && ($outer->start_time < $inner->start_time || $outer->end_time > $inner->end_time);
            });

            if ($contained) {
                $removeIds[] = $inner->id;
            }
        }

        if ($removeIds) {
            DB::table('clinic_staff_schedules')->whereIn('id', $removeIds)->delete();
        }
    }

    public function down(): void
    {
        // Data cleanup: the removed duplicate shifts are not restored.
    }
};
