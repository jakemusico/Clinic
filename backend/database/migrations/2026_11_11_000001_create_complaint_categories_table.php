<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Complaint categories previously hardcoded in the frontend
     * (COMPLAINT_CATEGORIES in utils/consultation.js), union of the medical
     * and dental lists with the duplicate "Other" merged into one "Others".
     */
    private const DEFAULT_CATEGORIES = [
        'Fever/Flu', 'Headache', 'Cough/Colds', 'Stomach Pain', 'Injury/Wound', 'Allergy',
        'Dizziness/BP', 'Toothache', 'Dental Cleaning', 'Extraction', 'Tooth Filling',
        'Cavity/Decay', 'Gum Problem', 'Others',
    ];

    public function up(): void
    {
        if (! Schema::hasTable('complaint_categories')) {
            Schema::create('complaint_categories', function (Blueprint $table) {
                $table->id();
                $table->string('name', 100)->unique();
                $table->boolean('is_active')->default(true);
                $table->integer('sort_order')->default(0);
                $table->timestamps();
            });
        }

        // Seed the defaults (idempotent: safe to run on databases that already have rows)
        foreach (self::DEFAULT_CATEGORIES as $i => $name) {
            DB::table('complaint_categories')->updateOrInsert(
                ['name' => $name],
                ['sort_order' => ($i + 1) * 10, 'is_active' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        if (Schema::hasTable('clinic_records') && ! Schema::hasColumn('clinic_records', 'complaint_category_id')) {
            Schema::table('clinic_records', function (Blueprint $table) {
                $table->foreignId('complaint_category_id')
                    ->nullable()
                    ->after('complaint_category')
                    ->constrained('complaint_categories')
                    ->nullOnDelete();
            });
        }

        $this->backfillCategoryIds();
    }

    /** Point existing records at their category by matching the stored name (case-insensitive). */
    private function backfillCategoryIds(): void
    {
        if (! Schema::hasColumn('clinic_records', 'complaint_category_id')) {
            return;
        }

        $byName = [];
        foreach (DB::table('complaint_categories')->select('id', 'name')->get() as $cat) {
            $byName[mb_strtolower($cat->name)] = $cat->id;
        }

        DB::table('clinic_records')
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
                        DB::table('clinic_records')
                            ->where('id', $row->id)
                            ->update(['complaint_category_id' => $byName[$key]]);
                    }
                }
            });
    }

    public function down(): void
    {
        if (Schema::hasTable('clinic_records') && Schema::hasColumn('clinic_records', 'complaint_category_id')) {
            Schema::table('clinic_records', function (Blueprint $table) {
                $table->dropConstrainedForeignId('complaint_category_id');
            });
        }

        Schema::dropIfExists('complaint_categories');
    }
};
