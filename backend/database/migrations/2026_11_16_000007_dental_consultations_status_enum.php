<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * dental_consultations.status was free varchar while the API only ever
     * accepts completed/pending/cancelled. Make the allowed set a real enum.
     */
    public function up(): void
    {
        // Anything outside the allowed set collapses to 'completed' (the column default).
        DB::table('dental_consultations')
            ->whereNotIn('status', ['completed', 'pending', 'cancelled'])
            ->update(['status' => 'completed']);

        DB::statement("ALTER TABLE dental_consultations MODIFY status ENUM('completed','pending','cancelled') NOT NULL DEFAULT 'completed'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE dental_consultations MODIFY status VARCHAR(255) NOT NULL DEFAULT 'completed'");
    }
};
