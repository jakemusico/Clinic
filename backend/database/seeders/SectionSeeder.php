<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Section;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class SectionSeeder extends Seeder
{
    public function run(): void
    {
        $sections = [
            // GRADE SCHOOL
            ['grade_level' => 'Kinder 1', 'name' => 'St. Michael', 'strand' => null],
            ['grade_level' => 'Kinder 2', 'name' => 'St. Raphael', 'strand' => null],
            ['grade_level' => 'Grade 1', 'name' => 'Fortitude', 'strand' => null],
            ['grade_level' => 'Grade 1', 'name' => 'Prudence', 'strand' => null],
            ['grade_level' => 'Grade 1', 'name' => 'Courourage', 'strand' => null], // Will fix typo in array below
            // Actually, let me just write them precisely:
        ];
        
        $data = [
            'Kinder 1' => [['St. Michael', null]],
            'Kinder 2' => [['St. Raphael', null]],
            'Grade 1' => [['Fortitude', null], ['Prudence', null], ['Courage', null]],
            'Grade 2' => [['Honesty', null], ['Piety', null]],
            'Grade 3' => [['Integrity', null], ['Peace', null]],
            'Grade 4' => [['Charity', null], ['Unity', null]],
            'Grade 5' => [['Generosity', null], ['Obedience', null]],
            'Grade 6' => [['Humility', null], ['Truth', null]],
            'Grade 7' => [['St. Luke', null], ['St. Mark', null], ['St. Matthew', null], ['St. Paul', null]],
            'Grade 8' => [['St. Catherine', null], ['St. Faustina', null], ['St. Rita', null], ['St. Teresa', null]],
            'Grade 9' => [['St. Aloysius', null], ['St. Edith Stein', null], ['St. Joseph', null]],
            'Grade 10' => [['St. Joan', null], ['St. Katharine', null], ['St. Philomena', null]],
            'Grade 11' => [
                ['St. Patrick', 'Business and Entrepreneurship'],
                ['St. David', 'Engineering and ICT'],
                ['St. Leo', 'Engineering and ICT'],
                ['St. Edmund', 'Arts, Social Sciences and Humanities'],
                ['St. Augustine', 'Medical and Health Services'],
                ['St. Clement', 'Medical and Health Services'],
                ['St. Sylvester', 'Medical and Health Services'],
            ],
            'Grade 12' => [
                ['St. Timothy', 'ABM'],
                ['St. Jude', 'HUMSS'],
                ['St. Andrew', 'STEM'],
                ['St. Stephen', 'STEM'],
                ['St. Titus', 'STEM'],
            ]
        ];

        $validSectionNames = [];

        foreach ($data as $gradeLevel => $secs) {
            foreach ($secs as $sec) {
                Section::updateOrCreate(
                    ['grade_level' => $gradeLevel, 'name' => $sec[0]],
                    ['strand' => $sec[1]]
                );
                $validSectionNames[] = $sec[0];
            }
        }

        // Migrate users
        $users = User::whereNotNull('section')->get();
        $invalidUsers = [];
        foreach ($users as $user) {
            // Find if the section exists in the new list
            $exists = Section::where('name', $user->section)->exists();
            if (!$exists) {
                $invalidUsers[] = [
                    'id' => $user->id,
                    'name' => $user->name,
                    'grade_level' => $user->grade_level,
                    'old_section' => $user->section
                ];
                $user->section = null;
                $user->save();
            } else {
                // Assuming they might have the correct grade level? We'll leave them if name matches.
                // Could also verify if grade_level matches.
                $sectionMatchesGrade = Section::where('name', $user->section)
                    ->where('grade_level', $user->grade_level)
                    ->exists();
                if (!$sectionMatchesGrade) {
                    $invalidUsers[] = [
                        'id' => $user->id,
                        'name' => $user->name,
                        'grade_level' => $user->grade_level,
                        'old_section' => $user->section . ' (mismatch grade)'
                    ];
                    $user->section = null;
                    $user->save();
                }
            }
        }

        if (count($invalidUsers) > 0) {
            echo "The following users had invalid sections and were set to NULL:\n";
            foreach ($invalidUsers as $iu) {
                echo "User ID {$iu['id']} - Grade: {$iu['grade_level']} - Old Section: {$iu['old_section']}\n";
            }
        } else {
            echo "All existing user sections were valid or already NULL.\n";
        }
    }
}
