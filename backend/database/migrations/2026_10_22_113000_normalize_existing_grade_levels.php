<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $normalize = function (?string $grade): ?string {
            if ($grade === null) {
                return null;
            }
            $trimmed = trim($grade);
            if ($trimmed === '') {
                return $trimmed;
            }

            // Matches "Grade 1", "grade 01", "grade1", "gr. 1", "gr 1", "G-1", "g1"
            if (preg_match('/^(?:grade|gr\.?|g)[\s\-_]*0*([1-9]|1[0-2])$/i', $trimmed, $m)) {
                return 'Grade ' . intval($m[1]);
            }

            // Matches plain numbers 1 through 12
            if (preg_match('/^0*([1-9]|1[0-2])$/', $trimmed, $m)) {
                return 'Grade ' . intval($m[1]);
            }

            // Matches "Kinder 1", "kinder 01", "kinder1", "kindergarten 1", "K-1"
            if (preg_match('/^(?:kinder|kindergarten|k)[\s\-_]*0*([1-2])$/i', $trimmed, $m)) {
                return 'Kinder ' . intval($m[1]);
            }

            return ucwords(strtolower($trimmed));
        };

        // 1. Normalize in sections table
        $sections = DB::table('sections')->get();
        foreach ($sections as $section) {
            $normalized = $normalize($section->grade_level);
            if ($normalized !== $section->grade_level) {
                // Check if updating would violate unique constraint ['grade_level', 'name']
                $conflict = DB::table('sections')
                    ->where('grade_level', $normalized)
                    ->where('name', $section->name)
                    ->where('id', '!=', $section->id)
                    ->exists();

                if (!$conflict) {
                    DB::table('sections')
                        ->where('id', $section->id)
                        ->update(['grade_level' => $normalized]);
                }
            }
        }

        // 2. Normalize in users table
        $users = DB::table('users')->whereNotNull('grade_level')->get();
        foreach ($users as $user) {
            $normalized = $normalize($user->grade_level);
            if ($normalized !== $user->grade_level) {
                DB::table('users')
                    ->where('id', $user->id)
                    ->update(['grade_level' => $normalized]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Normalization is a non-destructive data cleanup; no rollback needed.
    }
};
