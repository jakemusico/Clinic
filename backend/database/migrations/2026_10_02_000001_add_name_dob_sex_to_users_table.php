<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'first_name')) {
                $table->string('first_name', 100)->nullable()->after('name');
            }
            if (!Schema::hasColumn('users', 'middle_name')) {
                $table->string('middle_name', 100)->nullable()->after('first_name');
            }
            if (!Schema::hasColumn('users', 'last_name')) {
                $table->string('last_name', 100)->nullable()->after('middle_name');
            }
            if (!Schema::hasColumn('users', 'date_of_birth')) {
                $table->date('date_of_birth')->nullable()->after('last_name');
            }
            if (!Schema::hasColumn('users', 'sex')) {
                $table->enum('sex', ['male', 'female'])->nullable()->after('date_of_birth');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(array_filter([
                Schema::hasColumn('users', 'first_name')    ? 'first_name'    : null,
                Schema::hasColumn('users', 'middle_name')   ? 'middle_name'   : null,
                Schema::hasColumn('users', 'last_name')     ? 'last_name'     : null,
                Schema::hasColumn('users', 'date_of_birth') ? 'date_of_birth' : null,
                Schema::hasColumn('users', 'sex')           ? 'sex'           : null,
            ]));
        });
    }
};
