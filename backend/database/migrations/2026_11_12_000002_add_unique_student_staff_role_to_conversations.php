<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One chat thread per student and team: unique index on conversations (student_id, staff_role).
 *
 * Without it, parallel requests to "open my chat with the nurse" could each create a thread, and the
 * student would be split across duplicates.
 *
 * This migration NEVER deletes or changes data. If a student already has more than one thread with the
 * same team it stops and lists them (thread ids, status, number of messages), so you can decide which
 * to keep. Nothing is changed in that case.
 * (When this migration was written, the database had no duplicates.)
 */
return new class extends Migration
{
    private const INDEX = 'conversations_student_staff_role_unique';

    public function up(): void
    {
        if (! Schema::hasTable('conversations') || Schema::hasIndex('conversations', self::INDEX)) {
            return;
        }

        $groups = DB::table('conversations')
            ->select('student_id', 'staff_role', DB::raw('COUNT(*) AS rows_count'), DB::raw('GROUP_CONCAT(id ORDER BY id) AS ids'))
            ->groupBy('student_id', 'staff_role')
            ->having('rows_count', '>', 1)
            ->get();

        if ($groups->isNotEmpty()) {
            $lines = [];
            foreach ($groups as $g) {
                $lines[] = "student #{$g->student_id} has {$g->rows_count} '{$g->staff_role}' threads (ids {$g->ids}):";
                foreach (explode(',', $g->ids) as $id) {
                    $status   = DB::table('conversations')->where('id', $id)->value('status');
                    $messages = DB::table('messages')->where('conversation_id', $id)->count();
                    $lines[]  = "    thread #{$id}: status {$status}, {$messages} messages";
                }
            }

            throw new RuntimeException(
                "Cannot add the unique index on conversations (student_id, staff_role): some students have more than one thread with the same team.\n"
                . implode("\n", $lines)
                . "\nDecide which thread to keep (the extra ones need their messages moved or removed), then run the migration again. Nothing was changed."
            );
        }

        Schema::table('conversations', fn (Blueprint $t) => $t->unique(['student_id', 'staff_role'], self::INDEX));
    }

    public function down(): void
    {
        if (Schema::hasTable('conversations') && Schema::hasIndex('conversations', self::INDEX)) {
            Schema::table('conversations', fn (Blueprint $t) => $t->dropUnique(self::INDEX));
        }
    }
};
