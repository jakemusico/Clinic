<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create roles table
        if (!Schema::hasTable('roles')) {
            Schema::create('roles', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->string('slug')->unique();
                $table->string('description')->nullable();
                $table->timestamps();
            });
        }

        // 2. Seed default roles
        $now = now();
        $defaultRoles = [
            [
                'id'          => 1,
                'name'        => 'Admin',
                'slug'        => 'admin',
                'description' => 'System Administrator with full management access',
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'id'          => 2,
                'name'        => 'Nurse',
                'slug'        => 'nurse',
                'description' => 'Clinic Nurse and Health Personnel',
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'id'          => 3,
                'name'        => 'Dentist',
                'slug'        => 'dentist',
                'description' => 'Clinic Dental Health Professional',
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'id'          => 4,
                'name'        => 'Student',
                'slug'        => 'student',
                'description' => 'Enrolled Student Patient',
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'id'          => 5,
                'name'        => 'Faculty / Staff',
                'slug'        => 'faculty_staff',
                'description' => 'University Faculty or Non-Teaching Staff Patient',
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
        ];

        foreach ($defaultRoles as $r) {
            DB::table('roles')->updateOrInsert(
                ['id' => $r['id']],
                [
                    'name'        => $r['name'],
                    'slug'        => $r['slug'],
                    'description' => $r['description'],
                    'created_at'  => $r['created_at'],
                    'updated_at'  => $r['updated_at'],
                ]
            );
        }

        // 3. Add role_id to users table (nullable first for backfill)
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'role_id')) {
                $table->unsignedBigInteger('role_id')->nullable()->after('role');
            }
        });

        // 4. Backfill users.role_id from existing role string column
        DB::table('users')->where('role', 'admin')->update(['role_id' => 1]);
        DB::table('users')->whereIn('role', ['clinic_staff', 'nurse'])->update(['role_id' => 2]);
        DB::table('users')->where('role', 'dentist')->update(['role_id' => 3]);
        DB::table('users')->where('role', 'student')->update(['role_id' => 4]);
        DB::table('users')->whereIn('role', ['faculty_staff', 'faculty'])->update(['role_id' => 5]);

        // Any leftover rows default to Student (4)
        DB::table('users')->whereNull('role_id')->update(['role_id' => 4]);

        // 5. Make role_id NOT NULL and add foreign key constraint
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('role_id')->nullable(false)->change();
            
            // Check if foreign key already exists before adding
            // MySQL constraint naming convention
            $table->foreign('role_id', 'users_role_id_foreign')
                  ->references('id')
                  ->on('roles')
                  ->onDelete('restrict');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'role_id')) {
                $table->dropForeign('users_role_id_foreign');
                $table->dropColumn('role_id');
            }
        });

        Schema::dropIfExists('roles');
    }
};
