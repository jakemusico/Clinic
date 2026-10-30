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
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'grade_level')) {
                $table->string('grade_level', 50)->nullable()->after('department');
            }
            if (!Schema::hasColumn('users', 'section')) {
                $table->string('section', 100)->nullable()->after('grade_level');
            }
            if (!Schema::hasColumn('users', 'school_year')) {
                $table->string('school_year', 50)->nullable()->after('section');
            }
            if (!Schema::hasColumn('users', 'address')) {
                $table->text('address')->nullable()->after('contact_no');
            }
            if (!Schema::hasColumn('users', 'username')) {
                $table->string('username', 100)->nullable()->after('name');
            }
            if (!Schema::hasColumn('users', 'avatar')) {
                $table->longText('avatar')->nullable()->after('email');
            }
        });

        Schema::table('patients', function (Blueprint $table) {
            if (!Schema::hasColumn('patients', 'current_medications')) {
                $table->text('current_medications')->nullable()->after('allergies');
            }
            if (!Schema::hasColumn('patients', 'medical_conditions')) {
                $table->text('medical_conditions')->nullable()->after('current_medications');
            }
            if (!Schema::hasColumn('patients', 'other_health_notes')) {
                $table->text('other_health_notes')->nullable()->after('medical_history');
            }
            if (!Schema::hasColumn('patients', 'guardian_name')) {
                $table->string('guardian_name', 255)->nullable()->after('emergency_contact');
            }
            if (!Schema::hasColumn('patients', 'guardian_relationship')) {
                $table->string('guardian_relationship', 100)->nullable()->after('guardian_name');
            }
            if (!Schema::hasColumn('patients', 'guardian_contact')) {
                $table->string('guardian_contact', 50)->nullable()->after('guardian_relationship');
            }
            if (!Schema::hasColumn('patients', 'guardian_email')) {
                $table->string('guardian_email', 255)->nullable()->after('guardian_contact');
            }
            if (!Schema::hasColumn('patients', 'emergency_name')) {
                $table->string('emergency_name', 255)->nullable()->after('guardian_email');
            }
            if (!Schema::hasColumn('patients', 'emergency_relationship')) {
                $table->string('emergency_relationship', 100)->nullable()->after('emergency_name');
            }
            if (!Schema::hasColumn('patients', 'emergency_contact_no')) {
                $table->string('emergency_contact_no', 50)->nullable()->after('emergency_relationship');
            }
            if (!Schema::hasColumn('patients', 'emergency_alt_contact')) {
                $table->string('emergency_alt_contact', 50)->nullable()->after('emergency_contact_no');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(array_filter([
                Schema::hasColumn('users', 'grade_level') ? 'grade_level' : null,
                Schema::hasColumn('users', 'section') ? 'section' : null,
                Schema::hasColumn('users', 'school_year') ? 'school_year' : null,
                Schema::hasColumn('users', 'address') ? 'address' : null,
                Schema::hasColumn('users', 'username') ? 'username' : null,
                Schema::hasColumn('users', 'avatar') ? 'avatar' : null,
            ]));
        });

        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn(array_filter([
                Schema::hasColumn('patients', 'current_medications') ? 'current_medications' : null,
                Schema::hasColumn('patients', 'medical_conditions') ? 'medical_conditions' : null,
                Schema::hasColumn('patients', 'other_health_notes') ? 'other_health_notes' : null,
                Schema::hasColumn('patients', 'guardian_name') ? 'guardian_name' : null,
                Schema::hasColumn('patients', 'guardian_relationship') ? 'guardian_relationship' : null,
                Schema::hasColumn('patients', 'guardian_contact') ? 'guardian_contact' : null,
                Schema::hasColumn('patients', 'guardian_email') ? 'guardian_email' : null,
                Schema::hasColumn('patients', 'emergency_name') ? 'emergency_name' : null,
                Schema::hasColumn('patients', 'emergency_relationship') ? 'emergency_relationship' : null,
                Schema::hasColumn('patients', 'emergency_contact_no') ? 'emergency_contact_no' : null,
                Schema::hasColumn('patients', 'emergency_alt_contact') ? 'emergency_alt_contact' : null,
            ]));
        });
    }
};
