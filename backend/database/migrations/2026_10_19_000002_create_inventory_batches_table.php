<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained('inventory_items')->cascadeOnDelete();
            $table->string('batch_no')->nullable();
            $table->string('supplier')->nullable();
            $table->integer('quantity_in')->default(0);    // total stocked in this batch
            $table->integer('quantity_used')->default(0);  // total consumed from this batch
            $table->date('expiry_date')->nullable();       // required for Medicine
            $table->date('received_date')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_batches');
    }
};
