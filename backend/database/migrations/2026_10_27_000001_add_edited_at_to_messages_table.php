<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('messages') && !Schema::hasColumn('messages', 'edited_at')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->timestamp('edited_at')->nullable()->default(null)->after('body');
            });
        }

        // Reset edited_at to null for any messages whose body was never actually changed
        // (e.g. edited_at within 1 second of created_at or equal to updated_at from read/seen updates)
        if (Schema::hasTable('messages') && Schema::hasColumn('messages', 'edited_at')) {
            DB::table('messages')
                ->whereNotNull('edited_at')
                ->where(function ($query) {
                    $query->whereRaw('ABS(TIMESTAMPDIFF(SECOND, created_at, edited_at)) <= 1')
                          ->orWhere(function ($q) {
                              $q->whereColumn('edited_at', 'updated_at')
                                ->whereNotNull('read_at')
                                ->whereRaw('ABS(TIMESTAMPDIFF(SECOND, read_at, updated_at)) <= 1');
                          });
                })
                ->update(['edited_at' => null]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('messages') && Schema::hasColumn('messages', 'edited_at')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->dropColumn('edited_at');
            });
        }
    }
};
