<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('clinic_records') && !Schema::hasColumn('clinic_records', 'complaint_category')) {
            Schema::table('clinic_records', function (Blueprint $table) {
                $table->string('complaint_category')->nullable()->after('chief_complaint');
            });
        }

        if (Schema::hasTable('dental_consultations') && !Schema::hasColumn('dental_consultations', 'complaint_category')) {
            Schema::table('dental_consultations', function (Blueprint $table) {
                $table->string('complaint_category')->nullable()->after('reason_for_visit');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('clinic_records') && Schema::hasColumn('clinic_records', 'complaint_category')) {
            Schema::table('clinic_records', function (Blueprint $table) {
                $table->dropColumn('complaint_category');
            });
        }

        if (Schema::hasTable('dental_consultations') && Schema::hasColumn('dental_consultations', 'complaint_category')) {
            Schema::table('dental_consultations', function (Blueprint $table) {
                $table->dropColumn('complaint_category');
            });
        }
    }
};
