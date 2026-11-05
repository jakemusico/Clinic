<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Every clinic service belongs to one kind of care: 'medical' (nurse) or 'dental' (dentist).
 * The app used to guess this from the service name in the browser; now it is stored and enforced
 * by the API (service lists, booking, consultations).
 */
return new class extends Migration
{
    /** Services that are dental even if the name does not say so. */
    private const DENTAL_NAMES = ['Dental Cleaning', 'Dental Consultation'];

    public function up(): void
    {
        if (! Schema::hasColumn('clinic_services', 'care_type')) {
            Schema::table('clinic_services', function (Blueprint $table) {
                $table->string('care_type', 10)->default('medical')->after('name');
                $table->index('care_type');
            });
        }

        // Existing rows: dental when the name says so (Dental Cleaning, Dental Consultation, Tooth Extraction,
        // Tooth Filling ...), everything else is medical.
        foreach (DB::table('clinic_services')->select('id', 'name')->get() as $service) {
            $isDental = in_array($service->name, self::DENTAL_NAMES, true)
                || preg_match('/dental|tooth|teeth|oral|gum|extraction|dentist/i', $service->name) === 1;

            DB::table('clinic_services')
                ->where('id', $service->id)
                ->update(['care_type' => $isDental ? 'dental' : 'medical']);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('clinic_services', 'care_type')) {
            Schema::table('clinic_services', function (Blueprint $table) {
                $table->dropIndex(['care_type']);
                $table->dropColumn('care_type');
            });
        }
    }
};
