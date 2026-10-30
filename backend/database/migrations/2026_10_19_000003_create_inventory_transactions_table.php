<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained('inventory_items')->cascadeOnDelete();
            $table->foreignId('batch_id')->nullable()->constrained('inventory_batches')->nullOnDelete();
            $table->enum('type', ['IN', 'OUT']);
            $table->integer('quantity');
            $table->enum('reason', ['Stock In', 'Dispensed', 'Used in clinic', 'Expired', 'Damaged', 'Adjustment']);
            // Links to consultation
            $table->string('consultation_type')->nullable(); // 'medical' | 'dental'
            $table->unsignedBigInteger('consultation_id')->nullable();
            // Patient (for dispensed)
            $table->foreignId('patient_user_id')->nullable()->constrained('users')->nullOnDelete();
            // Recorded by
            $table->foreignId('recorded_by')->constrained('users');
            $table->date('transaction_date');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_transactions');
    }
};
