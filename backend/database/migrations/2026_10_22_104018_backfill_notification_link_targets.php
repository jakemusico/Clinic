<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Backfill link targets (target_type, target_id) for existing notifications where possible.
     */
    public function up(): void
    {
        // 1. Announcements: type = 'announcement' or has linked_id or title/message matches announcements table
        $announcements = DB::table('announcements')->get();
        foreach ($announcements as $ann) {
            DB::table('notifications')
                ->where(function ($q) use ($ann) {
                    $q->where('linked_id', $ann->id)
                      ->orWhere(function ($q2) use ($ann) {
                          $q2->where('type', 'announcement')
                             ->where('title', $ann->title);
                      });
                })
                ->whereNull('target_type')
                ->update([
                    'target_type' => 'announcement',
                    'target_id'   => $ann->id,
                ]);
        }

        // Also any remaining type = 'announcement' that has linked_id
        DB::table('notifications')
            ->where('type', 'announcement')
            ->whereNotNull('linked_id')
            ->whereNull('target_type')
            ->update([
                'target_type' => 'announcement',
                'target_id'   => DB::raw('linked_id'),
            ]);

        // 2. Calendar Events: action_url = '/calendar' or matched title in calendar_events
        $calendarEvents = DB::table('calendar_events')->get();
        foreach ($calendarEvents as $event) {
            DB::table('notifications')
                ->where(function ($q) use ($event) {
                    $q->where('linked_id', $event->id)
                      ->orWhere(function ($q2) use ($event) {
                          $q2->where('action_url', '/calendar')
                             ->where('title', $event->title);
                      });
                })
                ->whereNull('target_type')
                ->update([
                    'target_type' => 'calendar_event',
                    'target_id'   => $event->id,
                ]);
        }

        // Any calendar notification without an exact title match but with linked_id
        DB::table('notifications')
            ->where('action_url', '/calendar')
            ->whereNotNull('linked_id')
            ->whereNull('target_type')
            ->update([
                'target_type' => 'calendar_event',
                'target_id'   => DB::raw('linked_id'),
            ]);

        // 3. User accounts: registered or user created notifications
        $users = DB::table('users')->get();
        foreach ($users as $u) {
            DB::table('notifications')
                ->where(function ($q) use ($u) {
                    $q->where('title', 'like', '%User%')
                      ->where('message', 'like', "%{$u->email}%");
                })
                ->whereNull('target_type')
                ->update([
                    'target_type' => 'user',
                    'target_id'   => $u->id,
                ]);
        }

        // 4. Inventory items in notifications
        $items = DB::table('inventory_items')->get();
        foreach ($items as $item) {
            DB::table('notifications')
                ->where(function ($q) use ($item) {
                    $q->where('message', 'like', "%\"{$item->name}\"%")
                      ->orWhere('message', 'like', "%{$item->name}%");
                })
                ->where(function ($q) {
                    $q->where('title', 'like', '%Stock%')
                      ->orWhere('title', 'like', '%Expired%')
                      ->orWhere('title', 'like', '%Expiring%');
                })
                ->whereNull('target_type')
                ->update([
                    'target_type' => 'inventory_item',
                    'target_id'   => $item->id,
                ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op rollback for data backfill
    }
};
