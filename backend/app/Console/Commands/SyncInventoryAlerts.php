<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\InventoryController;
use Illuminate\Console\Command;

class SyncInventoryAlerts extends Command
{
    protected $signature = 'inventory:sync-alerts';

    protected $description = 'Create the low-stock and expiry alert notifications for the admins (once per item per day)';

    public function handle(): int
    {
        InventoryController::checkAlertsAndNotifyAdmins();

        $this->info('Inventory alerts checked.');

        return self::SUCCESS;
    }
}
