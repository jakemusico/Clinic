<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The "Help Page" toggle in Admin > Chatbot Support used to be stored only in
 * the admin's browser (localStorage), so it never affected what students see.
 * Store it on the FAQ row so the Help page can read FAQs from the server.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('chatbot_faqs', 'show_on_help')) {
            Schema::table('chatbot_faqs', function (Blueprint $table) {
                $table->boolean('show_on_help')->default(true)->after('is_active');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('chatbot_faqs', 'show_on_help')) {
            Schema::table('chatbot_faqs', function (Blueprint $table) {
                $table->dropColumn('show_on_help');
            });
        }
    }
};
