<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * notifications.target_type/target_id is the single polymorphic link.
     * linked_id was a duplicate used only for announcements and calendar events;
     * backfill any stragglers, then drop it and index the canonical columns.
     */
    public function up(): void
    {
        // Backfill target_id from linked_id where the canonical columns are still empty.
        DB::table('notifications')
            ->whereNotNull('linked_id')
            ->whereNull('target_id')
            ->update(['target_id' => DB::raw('linked_id')]);

        // Infer target_type for rows that only have linked_id.
        DB::table('notifications')
            ->whereNotNull('linked_id')
            ->whereNull('target_type')
            ->where('type', 'announcement')
            ->update(['target_type' => 'announcement']);

        DB::table('notifications')
            ->whereNotNull('linked_id')
            ->whereNull('target_type')
            ->where('action_url', '/calendar')
            ->update(['target_type' => 'calendar_event']);

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn('linked_id');
            $table->index(['target_type', 'target_id'], 'idx_notifications_target');
            $table->index(['user_id', 'id'], 'idx_notifications_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('idx_notifications_target');
            $table->dropIndex('idx_notifications_user_id');
            $table->unsignedBigInteger('linked_id')->nullable()->after('action_url');
        });
    }
};
