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
        if (!Schema::hasTable('chatbot_question_logs')) {
            Schema::create('chatbot_question_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('faq_id')->nullable()->constrained('chatbot_faqs')->nullOnDelete();
                $table->string('question', 500);
                $table->string('category', 50)->nullable();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index('faq_id');
                $table->index('category');
                $table->index('created_at');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chatbot_question_logs');
    }
};
