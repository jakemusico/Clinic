<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clinic_staff_unavailability', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->date('unavailable_date');
            $table->string('reason')->nullable();
            $table->timestamps();

            // A staff member can only block a specific date once
            $table->unique(['user_id', 'unavailable_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clinic_staff_unavailability');
    }
};
