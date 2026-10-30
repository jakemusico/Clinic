<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // For MySQL, we alter the enum column to include 'dentist'
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('student','faculty_staff','clinic_staff','dentist','admin') NOT NULL DEFAULT 'student'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('student','faculty_staff','clinic_staff','admin') NOT NULL DEFAULT 'student'");
    }
};
