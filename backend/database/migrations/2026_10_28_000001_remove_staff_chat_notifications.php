<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Notification;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Remove existing chat-type notifications for staff ("New message from [student]").
     * Student reply notifications ("New reply from Nurse/Dentist") are kept.
     */
    public function up(): void
    {
        Notification::where(function ($q) {
            $q->where('target_type', 'conversation')
              ->orWhere('action_url', 'like', '%/clinic/messages%')
              ->orWhere('title', 'like', 'New message from%');
        })
        ->where('title', 'not like', 'New reply from%')
        ->delete();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Deletion is intentional and non-reversible
    }
};
