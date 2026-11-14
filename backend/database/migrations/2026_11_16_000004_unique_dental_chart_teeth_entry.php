<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * dental_chart_teeth is an append-only history log (one row per condition
     * change; "latest" is derived). A unique(chart,tooth) would break history.
     * Instead block exact duplicate entries — same chart, tooth, condition,
     * recorder and second — which is what a double-submit produces.
     * (notes is encrypted TEXT and cannot be part of an index.)
     */
    public function up(): void
    {
        // Remove any pre-existing exact duplicates, keeping the oldest row.
        DB::statement('
            DELETE t1 FROM dental_chart_teeth t1
            INNER JOIN dental_chart_teeth t2
                ON t1.dental_chart_id = t2.dental_chart_id
               AND t1.tooth_number    = t2.tooth_number
               AND t1.condition       = t2.condition
               AND t1.recorded_by     = t2.recorded_by
               AND t1.created_at      = t2.created_at
               AND t1.id              > t2.id
        ');

        Schema::table('dental_chart_teeth', function (Blueprint $table) {
            $table->unique(
                ['dental_chart_id', 'tooth_number', 'condition', 'recorded_by', 'created_at'],
                'uniq_dental_chart_teeth_entry'
            );
        });
    }

    public function down(): void
    {
        Schema::table('dental_chart_teeth', function (Blueprint $table) {
            $table->dropUnique('uniq_dental_chart_teeth_entry');
        });
    }
};
