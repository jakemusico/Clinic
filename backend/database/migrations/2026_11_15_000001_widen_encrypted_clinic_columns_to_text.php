<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Encrypted attributes are stored as Laravel ciphertext, which is longer
     * than the original plaintext — widen every encrypted column to TEXT.
     * Changing varchar/text to text is lossless.
     */
    public function up(): void
    {
        Schema::table('clinic_records', function (Blueprint $table) {
            foreach (['diagnosis', 'treatment', 'prescription', 'remarks', 'chief_complaint', 'symptoms', 'assessment', 'recommendation', 'notes'] as $col) {
                $table->text($col)->nullable()->change();
            }
        });

        Schema::table('dental_consultations', function (Blueprint $table) {
            foreach (['reason_for_visit', 'dental_findings', 'diagnosis', 'treatment_performed', 'recommendations', 'notes', 'staff_notes'] as $col) {
                $table->text($col)->nullable()->change();
            }
        });

        Schema::table('dental_chart_teeth', function (Blueprint $table) {
            $table->text('notes')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Intentionally empty: shrinking TEXT back to VARCHAR(255) could
        // truncate ciphertext and destroy data, so rollback keeps TEXT.
    }
};
