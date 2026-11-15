<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Google sign-ups get a random unusable password, so they cannot log in
     * manually until they set one. has_password=false marks those accounts;
     * everyone else (regular registrations, admins) keeps the default true.
     *
     * Existing rows: false only for Google-created accounts that never set a
     * password — detected via the audit trail (google_signup / registered /
     * password_changed entries), with google_id as the fallback signal.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('has_password')->default(true)->after('password');
        });

        DB::statement("
            UPDATE users u SET u.has_password = 0
            WHERE u.google_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM audit_logs a
                  WHERE a.action = 'password_changed'
                    AND a.model_type = 'App\\\\Models\\\\User'
                    AND a.model_id = u.id
              )
              AND (
                  EXISTS (
                      SELECT 1 FROM audit_logs g
                      WHERE g.action = 'google_signup'
                        AND g.model_type = 'App\\\\Models\\\\User'
                        AND g.model_id = u.id
                  )
                  OR NOT EXISTS (
                      SELECT 1 FROM audit_logs r
                      WHERE r.action = 'registered'
                        AND r.model_type = 'App\\\\Models\\\\User'
                        AND r.model_id = u.id
                  )
              )
        ");
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('has_password');
        });
    }
};
