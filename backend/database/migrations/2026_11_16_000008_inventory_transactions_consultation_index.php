<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * inventory_transactions is looked up by (consultation_type, consultation_id)
     * whenever a consultation is saved or its stock is reversed — index the pair.
     */
    public function up(): void
    {
        Schema::table('inventory_transactions', function (Blueprint $table) {
            $table->index(['consultation_type', 'consultation_id'], 'idx_inventory_tx_consultation');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_transactions', function (Blueprint $table) {
            $table->dropIndex('idx_inventory_tx_consultation');
        });
    }
};
