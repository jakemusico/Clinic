<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            // Set when the 30-minute reminder has been sent, so it fires once.
            // Reset to NULL when the appointment is rescheduled.
            $table->timestamp('reminder_30m_sent_at')->nullable()->after('reminder_1h_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropColumn('reminder_30m_sent_at');
        });
    }
};
