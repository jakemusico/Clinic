<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Siblings and family members may share one phone number, so users.contact_no
 * is no longer unique. Replaces the unique index with a normal lookup index.
 * No data is changed or removed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasIndex('users', 'users_contact_no_unique')) {
                $table->dropUnique('users_contact_no_unique');
            }
            if (! Schema::hasIndex('users', 'users_contact_no_index')) {
                $table->index('contact_no', 'users_contact_no_index');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasIndex('users', 'users_contact_no_index')) {
                $table->dropIndex('users_contact_no_index');
            }
            if (! Schema::hasIndex('users', 'users_contact_no_unique')) {
                $table->unique('contact_no', 'users_contact_no_unique');
            }
        });
    }
};
