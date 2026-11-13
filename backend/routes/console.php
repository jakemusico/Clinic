<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Low-stock and expiry alerts for the admins. They used to be created by the polled GET /api/counters.
// Needs the scheduler to run: `php artisan schedule:work` while developing, a cron entry in production
// (* * * * * php /path/to/backend/artisan schedule:run). See the README.
Schedule::command('inventory:sync-alerts')->everyFiveMinutes()->withoutOverlapping();

// Appointment reminders (24h and 1h before confirmed appointments). Needs the scheduler:
// `php artisan schedule:work` while developing, a cron entry in production. See the README.
Schedule::command('appointments:send-reminders')->everyMinute()->withoutOverlapping();
