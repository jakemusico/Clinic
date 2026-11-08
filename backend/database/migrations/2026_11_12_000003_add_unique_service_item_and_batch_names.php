<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The database now enforces what the forms already check:
 *
 *   clinic_services.name                       unique
 *   inventory_items.name                       unique
 *   inventory_batches (item_id, batch_no)      unique  (a batch without a number, NULL, is not affected)
 *
 * Without the indexes, two people saving the same name at the same moment both get through.
 * Names are compared the way the table compares them (utf8mb4_unicode_ci: capitals and trailing spaces
 * do not make a name different), which is also how the index will treat them.
 *
 * This migration NEVER deletes or changes data. It checks all three first; if any duplicate exists it
 * stops and lists them all, and creates none of the indexes. Nothing is changed in that case.
 * (When this migration was written, the database had no duplicates.)
 */
return new class extends Migration
{
    private const SERVICES = 'clinic_services_name_unique';
    private const ITEMS    = 'inventory_items_name_unique';
    private const BATCHES  = 'inventory_batches_item_batch_unique';

    public function up(): void
    {
        $problems = [];

        if ($this->pending('clinic_services', self::SERVICES)) {
            foreach (DB::table('clinic_services')->select('name', DB::raw('COUNT(*) AS n'), DB::raw('GROUP_CONCAT(id ORDER BY id) AS ids'))
                ->groupBy('name')->having('n', '>', 1)->get() as $d) {
                $problems[] = "clinic_services.name \"{$d->name}\" is used by {$d->n} services (ids {$d->ids})";
            }
        }

        if ($this->pending('inventory_items', self::ITEMS)) {
            foreach (DB::table('inventory_items')->select('name', DB::raw('COUNT(*) AS n'), DB::raw('GROUP_CONCAT(id ORDER BY id) AS ids'))
                ->groupBy('name')->having('n', '>', 1)->get() as $d) {
                $problems[] = "inventory_items.name \"{$d->name}\" is used by {$d->n} items (ids {$d->ids})";
            }
        }

        if ($this->pending('inventory_batches', self::BATCHES)) {
            foreach (DB::table('inventory_batches')->select('item_id', 'batch_no', DB::raw('COUNT(*) AS n'), DB::raw('GROUP_CONCAT(id ORDER BY id) AS ids'))
                ->whereNotNull('batch_no')->groupBy('item_id', 'batch_no')->having('n', '>', 1)->get() as $d) {
                $problems[] = "inventory_batches: item #{$d->item_id} has batch number \"{$d->batch_no}\" on {$d->n} batches (ids {$d->ids})";
            }
        }

        if ($problems) {
            throw new RuntimeException(
                "Cannot add the unique indexes, these values are used more than once:\n  - " . implode("\n  - ", $problems)
                . "\nRename or merge them (the stock history of a batch or item must stay attached to the one you keep), then run the migration again. Nothing was changed."
            );
        }

        if ($this->pending('clinic_services', self::SERVICES)) {
            Schema::table('clinic_services', fn (Blueprint $t) => $t->unique('name', self::SERVICES));
        }
        if ($this->pending('inventory_items', self::ITEMS)) {
            Schema::table('inventory_items', fn (Blueprint $t) => $t->unique('name', self::ITEMS));
        }
        if ($this->pending('inventory_batches', self::BATCHES)) {
            Schema::table('inventory_batches', fn (Blueprint $t) => $t->unique(['item_id', 'batch_no'], self::BATCHES));
        }
    }

    public function down(): void
    {
        foreach ([['clinic_services', self::SERVICES], ['inventory_items', self::ITEMS], ['inventory_batches', self::BATCHES]] as [$table, $index]) {
            if (Schema::hasTable($table) && Schema::hasIndex($table, $index)) {
                Schema::table($table, fn (Blueprint $t) => $t->dropUnique($index));
            }
        }
    }

    /** The table exists and does not have this index yet. */
    private function pending(string $table, string $index): bool
    {
        return Schema::hasTable($table) && ! Schema::hasIndex($table, $index);
    }
};
