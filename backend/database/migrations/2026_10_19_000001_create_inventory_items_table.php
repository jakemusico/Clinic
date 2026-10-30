<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('category', ['Medicine', 'Supply', 'Equipment']);
            $table->string('unit')->default('pcs'); // e.g. tablets, bottles, pcs
            $table->integer('reorder_level')->default(0);
            $table->boolean('is_active')->default(true);
            // Equipment-specific
            $table->enum('equipment_status', ['Available', 'In Use', 'Under Repair', 'Retired'])->nullable();
            $table->string('location')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_items');
    }
};
