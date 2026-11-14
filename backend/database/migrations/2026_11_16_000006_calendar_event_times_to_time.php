<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * calendar_events.start_time/end_time were varchar; they hold 'HH:MM' from
     * <input type="time">. Normalize any stray formats, then store real times.
     */
    public function up(): void
    {
        foreach (['start_time', 'end_time'] as $column) {
            foreach (DB::table('calendar_events')->whereNotNull($column)->pluck($column, 'id') as $id => $value) {
                $value = trim((string) $value);
                if ($value === '') {
                    DB::table('calendar_events')->where('id', $id)->update([$column => null]);
                    continue;
                }
                try {
                    $normalized = Carbon::parse($value)->format('H:i:s');
                } catch (\Throwable) {
                    $normalized = null;
                }
                DB::table('calendar_events')->where('id', $id)->update([$column => $normalized]);
            }
        }

        Schema::table('calendar_events', function (Blueprint $table) {
            $table->time('start_time')->nullable()->change();
            $table->time('end_time')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->string('start_time')->nullable()->change();
            $table->string('end_time')->nullable()->change();
        });
    }
};
