<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * chatbot_faqs.category was a free-text name loosely matched to
     * chatbot_categories.name. Add a real FK and backfill by name.
     * The `category` string column stays as the denormalized display value.
     */
    public function up(): void
    {
        Schema::table('chatbot_faqs', function (Blueprint $table) {
            $table->unsignedBigInteger('category_id')->nullable()->after('category')->index();
        });

        DB::statement('
            UPDATE chatbot_faqs f
            JOIN chatbot_categories c ON LOWER(f.category) = LOWER(c.name)
            SET f.category_id = c.id
            WHERE f.category_id IS NULL
        ');

        Schema::table('chatbot_faqs', function (Blueprint $table) {
            $table->foreign('category_id')
                ->references('id')
                ->on('chatbot_categories')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('chatbot_faqs', function (Blueprint $table) {
            $table->dropForeign(['category_id']);
            $table->dropIndex(['category_id']);
            $table->dropColumn('category_id');
        });
    }
};
