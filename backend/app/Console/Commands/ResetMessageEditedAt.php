<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ResetMessageEditedAt extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'chat:reset-edited-at';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Reset edited_at to null for messages whose body was never changed';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        if (!Schema::hasTable('messages') || !Schema::hasColumn('messages', 'edited_at')) {
            $this->warn('The messages table does not have an edited_at column.');
            return 0;
        }

        $affected = DB::table('messages')
            ->whereNotNull('edited_at')
            ->where(function ($query) {
                $query->whereRaw('ABS(TIMESTAMPDIFF(SECOND, created_at, edited_at)) <= 1')
                      ->orWhere(function ($q) {
                          $q->whereColumn('edited_at', 'updated_at')
                            ->whereNotNull('read_at')
                            ->whereRaw('ABS(TIMESTAMPDIFF(SECOND, read_at, updated_at)) <= 1');
                      });
            })
            ->update(['edited_at' => null]);

        $this->info("Reset edited_at to null for {$affected} message(s).");

        return 0;
    }
}
