<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Multiple non-overlapping shifts per staff member per day are allowed
     * (split shifts), so uniqueness must include the times. This blocks only
     * exact duplicate rows.
     */
    public function up(): void
    {
        DB::statement('
            DELETE s1 FROM clinic_staff_schedules s1
            INNER JOIN clinic_staff_schedules s2
                ON s1.user_id     = s2.user_id
               AND s1.day_of_week = s2.day_of_week
               AND s1.start_time  = s2.start_time
               AND s1.end_time    = s2.end_time
               AND s1.id          > s2.id
        ');

        Schema::table('clinic_staff_schedules', function (Blueprint $table) {
            $table->unique(
                ['user_id', 'day_of_week', 'start_time', 'end_time'],
                'uniq_staff_schedule_slot'
            );
        });
    }

    public function down(): void
    {
        Schema::table('clinic_staff_schedules', function (Blueprint $table) {
            $table->dropUnique('uniq_staff_schedule_slot');
        });
    }
};
