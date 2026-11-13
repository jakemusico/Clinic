<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            // Set when the 24h / 1h reminder has been sent, so each fires once.
            // Reset to NULL when the appointment is rescheduled.
            $table->timestamp('reminder_24h_sent_at')->nullable()->after('status');
            $table->timestamp('reminder_1h_sent_at')->nullable()->after('reminder_24h_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropColumn(['reminder_24h_sent_at', 'reminder_1h_sent_at']);
        });
    }
};
