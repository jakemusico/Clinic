<?php

namespace App\Console\Commands;

use App\Models\Patient;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * One-time repair: create missing Patient rows for student/faculty users.
 * Patient profiles are normally created at registration; this backfills accounts
 * that predate that, so list endpoints no longer create rows on read requests.
 */
class BackfillPatients extends Command
{
    protected $signature = 'patients:backfill';
    protected $description = 'Create missing Patient profiles for student/faculty users';

    public function handle(): int
    {
        $created = 0;
        User::whereIn('role', ['student', 'faculty_staff'])
            ->whereDoesntHave('patient')
            ->chunkById(200, function ($users) use (&$created) {
                foreach ($users as $user) {
                    Patient::create(['user_id' => $user->id]);
                    $created++;
                }
            });

        $this->info("Created {$created} patient profile(s).");
        return self::SUCCESS;
    }
}
