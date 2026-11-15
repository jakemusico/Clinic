<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Some consultation rows saved only the complaint_category display string
     * and left complaint_category_id NULL (written before the FK existed, or via
     * a path that bypassed ComplaintCategoryResolver). Re-run the name-based
     * backfill on both tables — idempotent — and canonicalize the stored name
     * ('Other' -> 'Others', correct casing) while we're at it.
     *
     * Medical records prefer medical categories, dental records dental ones,
     * so a shared name like 'Others' links to the right type.
     */
    public function up(): void
    {
        $this->backfill('clinic_records', 'medical');
        $this->backfill('dental_consultations', 'dental');
    }

    private function backfill(string $table, string $preferType): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'complaint_category_id')) {
            return;
        }

        $byName = [];
        foreach (DB::table('complaint_categories')->select('id', 'name', 'type')->get() as $cat) {
            $key = mb_strtolower(trim($cat->name));
            if ($key === 'other') {
                $key = 'others';
            }
            // The preferred type wins ties (e.g. 'Others' exists as medical and dental).
            if (! isset($byName[$key]) || $cat->type === $preferType) {
                $byName[$key] = ['id' => $cat->id, 'name' => $cat->name];
            }
        }

        DB::table($table)
            ->whereNull('complaint_category_id')
            ->whereNotNull('complaint_category')
            ->where('complaint_category', '!=', '')
            ->select('id', 'complaint_category')
            ->orderBy('id')
            ->chunk(200, function ($rows) use ($table, $byName) {
                foreach ($rows as $row) {
                    $key = mb_strtolower(trim($row->complaint_category));
                    if ($key === 'other') {
                        $key = 'others';
                    }
                    if (isset($byName[$key])) {
                        DB::table($table)->where('id', $row->id)->update([
                            'complaint_category_id' => $byName[$key]['id'],
                            'complaint_category'    => $byName[$key]['name'],
                        ]);
                    }
                }
            });
    }

    public function down(): void
    {
        // Data backfill: the linked category ids are not unset.
    }
};
