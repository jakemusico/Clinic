<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chatbot_faqs', function (Blueprint $table) {
            $table->text('keywords')->nullable()->after('category')
                ->comment('Comma-separated keywords for intent matching');
        });
    }

    public function down(): void
    {
        Schema::table('chatbot_faqs', function (Blueprint $table) {
            $table->dropColumn('keywords');
        });
    }
};
