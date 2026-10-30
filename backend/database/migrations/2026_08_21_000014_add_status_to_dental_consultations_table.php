<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dental_consultations', function (Blueprint $table) {
            $table->string('status')->default('completed')->after('consultation_date');
        });
    }

    public function down(): void
    {
        Schema::table('dental_consultations', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
