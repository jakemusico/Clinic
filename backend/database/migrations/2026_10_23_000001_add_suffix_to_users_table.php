<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'suffix')) {
                $table->string('suffix', 50)->nullable()->after('last_name');
            }
        });

        // Split existing full names into first_name, middle_name, last_name, suffix without deleting data
        $users = DB::table('users')->get();
        $commonSuffixes = ['Jr.', 'Jr', 'Sr.', 'Sr', 'II', 'III', 'IV', 'V'];

        foreach ($users as $user) {
            $updates = [];
            $fullName = trim($user->name ?? '');

            // If suffix is empty, check if fullName ends with a common suffix
            $suffixVal = $user->suffix ?? null;
            if (empty($suffixVal) && !empty($fullName)) {
                $parts = preg_split('/\s+/', $fullName);
                $lastToken = end($parts);
                foreach ($commonSuffixes as $cs) {
                    if (strcasecmp($lastToken, $cs) === 0) {
                        $suffixVal = $lastToken;
                        array_pop($parts);
                        $fullName = implode(' ', $parts);
                        $updates['suffix'] = $suffixVal;
                        break;
                    }
                }
            }

            // If first_name or last_name is empty, split the name
            if (empty($user->first_name) || empty($user->last_name)) {
                $parts = preg_split('/\s+/', $fullName);
                $count = count($parts);

                if ($count === 1) {
                    $updates['first_name'] = $user->first_name ?: $parts[0];
                    $updates['last_name']  = $user->last_name ?: '';
                } elseif ($count === 2) {
                    $updates['first_name'] = $user->first_name ?: $parts[0];
                    $updates['last_name']  = $user->last_name ?: $parts[1];
                } elseif ($count === 3) {
                    $updates['first_name']  = $user->first_name ?: $parts[0];
                    $updates['middle_name'] = $user->middle_name ?: $parts[1];
                    $updates['last_name']   = $user->last_name ?: $parts[2];
                } elseif ($count > 3) {
                    $updates['first_name']  = $user->first_name ?: $parts[0];
                    $updates['middle_name'] = $user->middle_name ?: $parts[1];
                    $updates['last_name']   = $user->last_name ?: implode(' ', array_slice($parts, 2));
                }
            }

            if (!empty($updates)) {
                DB::table('users')->where('id', $user->id)->update($updates);
            }
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'suffix')) {
                $table->dropColumn('suffix');
            }
        });
    }
};
