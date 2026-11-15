<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Older low-stock/expiry notifications stored '/admin/inventory/items?...'
     * action URLs. The frontend now serves inventory under '/clinic/inventory'
     * (a redirect exists as a safety net, but stored URLs should be correct).
     */
    public function up(): void
    {
        DB::table('notifications')
            ->where('action_url', 'like', '/admin/inventory%')
            ->update([
                'action_url' => DB::raw("REPLACE(action_url, '/admin/inventory', '/clinic/inventory')"),
            ]);
    }

    public function down(): void
    {
        DB::table('notifications')
            ->where('action_url', 'like', '/clinic/inventory%')
            ->update([
                'action_url' => DB::raw("REPLACE(action_url, '/clinic/inventory', '/admin/inventory')"),
            ]);
    }
};
