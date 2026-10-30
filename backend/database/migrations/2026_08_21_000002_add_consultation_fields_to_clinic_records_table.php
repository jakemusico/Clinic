<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clinic_records', function (Blueprint $table) {
            $table->json('vitals')->nullable()->after('visit_date');
            $table->text('chief_complaint')->nullable()->after('vitals');
            $table->text('symptoms')->nullable()->after('chief_complaint');
            $table->text('assessment')->nullable()->after('symptoms');
            $table->text('recommendation')->nullable()->after('assessment');
            $table->text('notes')->nullable()->after('recommendation');
        });
    }

    public function down(): void
    {
        Schema::table('clinic_records', function (Blueprint $table) {
            $table->dropColumn([
                'vitals',
                'chief_complaint',
                'symptoms',
                'assessment',
                'recommendation',
                'notes',
            ]);
        });
    }
};
