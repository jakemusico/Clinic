<?php

use App\Support\PhoneNumber;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A user's own contact number (users.contact_no) must be unique.
 *
 * Only users.contact_no. Guardian and emergency numbers on the patients table are NOT unique
 * (brothers and sisters share them). Users with no number (NULL) are not affected.
 *
 * This migration NEVER deletes or changes data. If two or more users share a number it stops and
 * lists them (user id, name, email, role, number) so you decide who keeps it; nothing is changed.
 * Numbers are compared after normalising, so 0917-111-2222 and 09171112222 count as the same number.
 *
 * Order: run 2026_11_10_000001 (normalize) first, resolve the duplicates it cannot, then this one.
 */
return new class extends Migration
{
    private const INDEX = 'users_contact_no_unique';

    public function up(): void
    {
        if (! Schema::hasTable('users') || Schema::hasIndex('users', self::INDEX)) {
            return;
        }

        $groups = [];
        $notCanonical = [];

        foreach (DB::table('users')->whereNotNull('contact_no')->orderBy('id')->get(['id', 'first_name', 'last_name', 'email', 'role', 'contact_no']) as $u) {
            if (PhoneNumber::isBlank($u->contact_no)) {
                $notCanonical[] = "user {$u->id}: empty text instead of NULL";
                continue;
            }

            $key = PhoneNumber::normalize($u->contact_no) ?? 'TEXT:' . trim($u->contact_no);
            $groups[$key][] = $u;

            if (! PhoneNumber::isCanonical($u->contact_no)) {
                $notCanonical[] = "user {$u->id}: " . json_encode($u->contact_no);
            }
        }

        $duplicates = array_filter($groups, fn ($users) => count($users) > 1);

        if ($duplicates) {
            $lines = [];
            foreach ($duplicates as $number => $users) {
                $lines[] = "{$number} is used by " . count($users) . ' users:';
                foreach ($users as $u) {
                    $lines[] = "    user #{$u->id}  " . trim("{$u->first_name} {$u->last_name}") . "  <{$u->email}>  role={$u->role}  stored=" . json_encode($u->contact_no);
                }
            }

            throw new RuntimeException(
                "Cannot add the unique index on users.contact_no: some numbers belong to more than one user.\n"
                . implode("\n", $lines)
                . "\nChange or clear the number of all but one user in each group (Admin > Users, or the profile page), then run the migration again. Nothing was changed."
            );
        }

        if ($notCanonical) {
            throw new RuntimeException(
                "Some contact numbers are not in the 09XXXXXXXXX form yet:\n  " . implode("\n  ", $notCanonical)
                . "\nRun the normalize migration (2026_11_10_000001) first, then run this one again. Nothing was changed."
            );
        }

        Schema::table('users', fn (Blueprint $t) => $t->unique('contact_no', self::INDEX));
    }

    public function down(): void
    {
        if (Schema::hasTable('users') && Schema::hasIndex('users', self::INDEX)) {
            Schema::table('users', fn (Blueprint $t) => $t->dropUnique(self::INDEX));
        }
    }
};
