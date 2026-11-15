<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * users.guardian_relationship duplicated patients.guardian_relationship
     * (patients also carries guardian_name/contact/email). Copy any value still
     * only on users into the linked patient row, then drop the users column.
     *
     * Also fills demographic gaps on patients from users — users remains the
     * write path for date_of_birth / sex / age, and patient rows created before
     * the profile sync existed may have these fields empty.
     */
    public function up(): void
    {
        if (Schema::hasColumn('users', 'guardian_relationship') && Schema::hasColumn('patients', 'guardian_relationship')) {
            DB::statement("
                UPDATE patients p
                JOIN users u ON u.id = p.user_id
                SET p.guardian_relationship = u.guardian_relationship
                WHERE u.guardian_relationship IS NOT NULL
                  AND TRIM(u.guardian_relationship) != ''
                  AND (p.guardian_relationship IS NULL OR TRIM(p.guardian_relationship) = '')
            ");

            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('guardian_relationship');
            });
        }

        DB::statement("
            UPDATE patients p
            JOIN users u ON u.id = p.user_id
            SET p.date_of_birth = COALESCE(p.date_of_birth, u.date_of_birth),
                p.gender        = COALESCE(NULLIF(p.gender, ''), NULLIF(u.sex, '')),
                p.age           = COALESCE(p.age, u.age)
            WHERE (p.date_of_birth IS NULL AND u.date_of_birth IS NOT NULL)
               OR (p.gender IS NULL OR p.gender = '') AND u.sex IS NOT NULL AND u.sex != ''
               OR (p.age IS NULL AND u.age IS NOT NULL)
        ");
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'guardian_relationship')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('guardian_relationship')->nullable()->after('terms_accepted_at');
            });
        }
        // The copied guardian values are not moved back; they remain on patients.
    }
};
