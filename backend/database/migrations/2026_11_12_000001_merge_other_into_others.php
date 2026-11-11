<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Merges every "Other" complaint category into that care type's "Others",
 * re-points consultation records (by id and by plain-text name), then removes
 * the "Other" category rows. Safe to run once; down() is a no-op because the
 * merge cannot be undone.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Make sure each care type has an "Others" category
        $othersIdByType = [];
        foreach (['medical', 'dental'] as $type) {
            $others = DB::table('complaint_categories')
                ->where('type', $type)
                ->whereRaw('LOWER(TRIM(name)) = ?', ['others'])
                ->first();

            if (! $others) {
                $maxOrder = (int) DB::table('complaint_categories')->where('type', $type)->max('sort_order');
                $othersIdByType[$type] = DB::table('complaint_categories')->insertGetId([
                    'name'       => 'Others',
                    'type'       => $type,
                    'is_active'  => true,
                    'sort_order' => $maxOrder + 10,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                $othersIdByType[$type] = $others->id;
            }
        }

        // 2. Every "Other" category row, per care type
        $otherCategories = DB::table('complaint_categories')
            ->whereRaw('LOWER(TRIM(name)) = ?', ['other'])
            ->get();

        foreach ($otherCategories as $cat) {
            $othersId = $othersIdByType[$cat->type] ?? $othersIdByType['medical'];
            $this->mergeRecords('clinic_records', 'medical', $cat->id, $othersId);
            $this->mergeRecords('dental_consultations', 'dental', $cat->id, $othersId);

            DB::table('complaint_categories')->where('id', $cat->id)->delete();
        }

        // 3. Any remaining plain-text "Other" (records with no category id at all)
        foreach ([['clinic_records', 'medical'], ['dental_consultations', 'dental']] as [$table, $type]) {
            DB::table($table)
                ->whereRaw('LOWER(TRIM(complaint_category)) = ?', ['other'])
                ->update([
                    'complaint_category'    => 'Others',
                    'complaint_category_id' => $othersIdByType[$type],
                ]);
        }
    }

    /** Re-point records that reference the "Other" category by id or by plain-text name. */
    private function mergeRecords(string $table, string $type, int $otherId, int $othersId): void
    {
        DB::table($table)->where('complaint_category_id', $otherId)->update([
            'complaint_category'    => 'Others',
            'complaint_category_id' => $othersId,
        ]);

        DB::table($table)
            ->whereNull('complaint_category_id')
            ->whereRaw('LOWER(TRIM(complaint_category)) = ?', ['other'])
            ->update([
                'complaint_category'    => 'Others',
                'complaint_category_id' => $othersId,
            ]);
    }

    public function down(): void
    {
        // The merge is not reversible: "Other" rows and their distinct identity are gone.
    }
};
