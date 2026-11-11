<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Categories that belong to dental care (tooth / gum related). */
    private const DENTAL_NAMES = [
        'Toothache', 'Dental Cleaning', 'Extraction',
        'Tooth Filling', 'Cavity/Decay', 'Gum Problem',
    ];

    public function up(): void
    {
        // ── complaint_categories: type column + unique (type, name) ──
        Schema::table('complaint_categories', function (Blueprint $table) {
            $table->dropUnique('complaint_categories_name_unique');
            $table->enum('type', ['medical', 'dental'])->default('medical')->after('name');
            $table->unique(['type', 'name']);
        });

        // Tooth/gum categories become dental; everything else stays medical
        DB::table('complaint_categories')
            ->whereIn('name', self::DENTAL_NAMES)
            ->update(['type' => 'dental']);

        // One "Others" per type: the seeded row is medical, add the dental one
        $hasDentalOthers = DB::table('complaint_categories')
            ->where('type', 'dental')->where('name', 'Others')->exists();
        if (! $hasDentalOthers) {
            $medicalOthers = DB::table('complaint_categories')
                ->where('type', 'medical')->where('name', 'Others')->first();
            DB::table('complaint_categories')->insert([
                'name'       => 'Others',
                'type'       => 'dental',
                'is_active'  => true,
                'sort_order' => $medicalOthers->sort_order ?? 999,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // ── dental_consultations: link records to their category ──
        if (Schema::hasTable('dental_consultations') && ! Schema::hasColumn('dental_consultations', 'complaint_category_id')) {
            Schema::table('dental_consultations', function (Blueprint $table) {
                $table->foreignId('complaint_category_id')
                    ->nullable()
                    ->after('complaint_category')
                    ->constrained('complaint_categories')
                    ->nullOnDelete();
            });
        }

        $this->backfillDentalCategoryIds();
    }

    /** Point dental consultations at their category by matching the stored name (case-insensitive, dental type first). */
    private function backfillDentalCategoryIds(): void
    {
        if (! Schema::hasColumn('dental_consultations', 'complaint_category_id')) {
            return;
        }

        $byName = [];
        foreach (DB::table('complaint_categories')->select('id', 'name', 'type')->get() as $cat) {
            $key = mb_strtolower($cat->name);
            // dental names win ties so a dental record never links a medical-only category
            if (! isset($byName[$key]) || $cat->type === 'dental') {
                $byName[$key] = $cat->id;
            }
        }

        DB::table('dental_consultations')
            ->whereNull('complaint_category_id')
            ->whereNotNull('complaint_category')
            ->where('complaint_category', '!=', '')
            ->select('id', 'complaint_category')
            ->orderBy('id')
            ->chunk(200, function ($rows) use ($byName) {
                foreach ($rows as $row) {
                    $key = mb_strtolower(trim($row->complaint_category));
                    if ($key === 'other') {
                        $key = 'others';
                    }
                    if (isset($byName[$key])) {
                        DB::table('dental_consultations')
                            ->where('id', $row->id)
                            ->update(['complaint_category_id' => $byName[$key]]);
                    }
                }
            });
    }

    public function down(): void
    {
        if (Schema::hasTable('dental_consultations') && Schema::hasColumn('dental_consultations', 'complaint_category_id')) {
            Schema::table('dental_consultations', function (Blueprint $table) {
                $table->dropConstrainedForeignId('complaint_category_id');
            });
        }

        // Merge the two "Others" rows back into one before restoring the unique name
        $dentalOthers = DB::table('complaint_categories')->where('type', 'dental')->where('name', 'Others')->first();
        if ($dentalOthers) {
            DB::table('complaint_categories')->where('id', $dentalOthers->id)->delete();
        }

        Schema::table('complaint_categories', function (Blueprint $table) {
            $table->dropUnique(['type', 'name']);
            $table->dropColumn('type');
            $table->unique('name');
        });
    }
};
