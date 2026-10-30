<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dental_charts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->unique()->constrained('patients')->onDelete('cascade');
            $table->timestamps();
        });

        Schema::create('dental_chart_teeth', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dental_chart_id')->constrained('dental_charts')->onDelete('cascade');
            $table->unsignedTinyInteger('tooth_number'); // 11-48 FDI notation (or 1-32 universal)
            $table->enum('condition', ['healthy', 'cavity', 'filled', 'extracted', 'missing', 'treated'])->default('healthy');
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->constrained('users')->onDelete('restrict');
            $table->timestamps();

            $table->index(['dental_chart_id', 'tooth_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dental_chart_teeth');
        Schema::dropIfExists('dental_charts');
    }
};
