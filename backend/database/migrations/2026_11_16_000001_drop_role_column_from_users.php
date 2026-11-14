<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * users.role_id (FK -> roles) is the single source of truth for a user's role.
     * The users.role enum was a denormalized copy kept in sync by a model hook; drop it.
     */
    public function up(): void
    {
        // Backfill role_id from the legacy role slug (resolving aliases) before dropping it.
        DB::statement("
            UPDATE users u
            JOIN roles r ON r.slug = CASE
                WHEN u.role = 'nurse'   THEN 'clinic_staff'
                WHEN u.role = 'faculty' THEN 'faculty_staff'
                ELSE u.role
            END
            SET u.role_id = r.id
            WHERE u.role_id IS NULL OR u.role_id <> r.id
        ");

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['student', 'faculty_staff', 'clinic_staff', 'dentist', 'admin'])
                ->default('student')
                ->after('password');
        });

        // Restore the slug from roles so reads keep working.
        DB::statement('
            UPDATE users u
            JOIN roles r ON r.id = u.role_id
            SET u.role = r.slug
        ');

        Schema::table('users', function (Blueprint $table) {
            $table->index('role', 'idx_users_role');
        });
    }
};
