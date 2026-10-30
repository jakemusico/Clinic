<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Section;

class KinderSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Safe to run more than once: updateOrCreate prevents duplicates.
        Section::updateOrCreate(
            ['grade_level' => 'Kinder 1', 'name' => 'St. Michael'],
            ['strand' => null]
        );

        Section::updateOrCreate(
            ['grade_level' => 'Kinder 2', 'name' => 'St. Raphael'],
            ['strand' => null]
        );
    }
}
