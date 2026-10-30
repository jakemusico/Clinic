<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (!Schema::hasColumn('notifications', 'target_type')) {
                $table->string('target_type', 50)->nullable()->after('type');
            }
            if (!Schema::hasColumn('notifications', 'target_id')) {
                $table->unsignedBigInteger('target_id')->nullable()->after('target_type');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (Schema::hasColumn('notifications', 'target_id')) {
                $table->dropColumn('target_id');
            }
            if (Schema::hasColumn('notifications', 'target_type')) {
                $table->dropColumn('target_type');
            }
        });
    }
};
