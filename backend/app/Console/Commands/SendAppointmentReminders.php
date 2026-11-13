<?php

namespace App\Console\Commands;

use App\Support\AppointmentReminders;
use Illuminate\Console\Command;

/**
 * Optional: send appointment reminders from the scheduler/cron. Not required —
 * the notifications poll creates due reminders on its own (see AppointmentReminders::forUser).
 * Kept for setups that do run Laravel's scheduler.
 */
class SendAppointmentReminders extends Command
{
    protected $signature = 'appointments:send-reminders';
    protected $description = 'Send 24-hour and 1-hour reminders for confirmed appointments';

    public function handle(): int
    {
        $sent = AppointmentReminders::forAll();

        if ($sent > 0) {
            $this->info("Sent {$sent} reminder(s).");
        }

        return self::SUCCESS;
    }
}
