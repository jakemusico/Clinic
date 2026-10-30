<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add linked_id to notifications so we can find/delete notifications
 * that belong to a specific announcement or calendar event.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (!Schema::hasColumn('notifications', 'linked_id')) {
                // Nullable unsigned bigint – no FK so we can link to different tables
                $table->unsignedBigInteger('linked_id')->nullable()->after('action_url');
            }
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (Schema::hasColumn('notifications', 'linked_id')) {
                $table->dropColumn('linked_id');
            }
        });
    }
};
