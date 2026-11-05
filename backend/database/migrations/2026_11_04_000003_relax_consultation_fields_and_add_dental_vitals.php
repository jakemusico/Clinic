<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Only patient, date, service and the reason for the visit are required on a consultation.
 *  - clinic_records.diagnosis was NOT NULL (the app filled it with a made-up default); it may now be empty.
 *  - dental consultations get the same optional vital signs as medical ones.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clinic_records', function (Blueprint $table) {
            $table->string('diagnosis')->nullable()->change();
        });

        if (! Schema::hasColumn('dental_consultations', 'vitals')) {
            Schema::table('dental_consultations', function (Blueprint $table) {
                $table->json('vitals')->nullable()->after('reason_for_visit');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('dental_consultations', 'vitals')) {
            Schema::table('dental_consultations', function (Blueprint $table) {
                $table->dropColumn('vitals');
            });
        }

        DB::table('clinic_records')->whereNull('diagnosis')->update(['diagnosis' => '']);
        Schema::table('clinic_records', function (Blueprint $table) {
            $table->string('diagnosis')->nullable(false)->change();
        });
    }
};
