<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dental_consultations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->onDelete('cascade');
            $table->foreignId('appointment_id')->nullable()->constrained('appointments')->onDelete('set null');
            $table->foreignId('created_by')->constrained('users')->onDelete('restrict');
            $table->date('consultation_date');
            $table->text('reason_for_visit')->nullable();
            $table->json('affected_teeth')->nullable(); // Array of tooth numbers
            $table->text('dental_findings')->nullable();
            $table->string('diagnosis')->nullable();
            $table->text('treatment_performed')->nullable();
            $table->text('recommendations')->nullable();
            $table->text('notes')->nullable();        // Patient-visible
            $table->text('staff_notes')->nullable();  // Dentist-only, never shown to patient
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dental_consultations');
    }
};
