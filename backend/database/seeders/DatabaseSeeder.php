<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Seed default roles
        $roles = [
            ['id' => 1, 'name' => 'Admin', 'slug' => 'admin', 'description' => 'System Administrator with full management access'],
            ['id' => 2, 'name' => 'Nurse', 'slug' => 'nurse', 'description' => 'Clinic Nurse and Health Personnel'],
            ['id' => 3, 'name' => 'Dentist', 'slug' => 'dentist', 'description' => 'Clinic Dental Health Professional'],
            ['id' => 4, 'name' => 'Student', 'slug' => 'student', 'description' => 'Enrolled Student Patient'],
            ['id' => 5, 'name' => 'Faculty / Staff', 'slug' => 'faculty_staff', 'description' => 'University Faculty or Non-Teaching Staff Patient'],
        ];

        foreach ($roles as $r) {
            \App\Models\Role::updateOrCreate(['id' => $r['id']], $r);
        }

        // Admin
        User::firstOrCreate(
            ['email' => 'admin@clinic.local'],
            [
                'first_name' => 'System',
                'last_name' => 'Administrator',
                'password' => \Illuminate\Support\Facades\Hash::make('password123'),
                'role_id' => 1,
                'role' => 'admin',
            ]
        );

        // Clinic Staff (Nurse)
        $nurse = User::firstOrCreate(
            ['email' => 'nurse@clinic.local'],
            [
                'title' => 'Nurse',
                'first_name' => 'Nurse',
                'last_name' => 'Joy',
                'password' => \Illuminate\Support\Facades\Hash::make('password123'),
                'role_id' => 2,
                'role' => 'clinic_staff',
            ]
        );

        // Dentist
        $dentist = User::firstOrCreate(
            ['email' => 'dentist@clinic.local'],
            [
                'title' => 'Dr.',
                'first_name' => 'Arthur',
                'last_name' => 'Dent',
                'password' => \Illuminate\Support\Facades\Hash::make('password123'),
                'role_id' => 3,
                'role' => 'dentist',
            ]
        );

        // Seed default working schedules (Mon-Fri 08:00-12:00, 13:00-17:00)
        $days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        foreach ([$nurse->id, $dentist->id] as $staffId) {
            foreach ($days as $day) {
                \App\Models\ClinicStaffSchedule::firstOrCreate(
                    [
                        'user_id'     => $staffId,
                        'day_of_week' => $day,
                        'start_time'  => '08:00',
                    ],
                    [
                        'end_time'     => '12:00',
                        'is_available' => true,
                        'notes'        => 'Morning Clinic Duty',
                    ]
                );
                \App\Models\ClinicStaffSchedule::firstOrCreate(
                    [
                        'user_id'     => $staffId,
                        'day_of_week' => $day,
                        'start_time'  => '13:00',
                    ],
                    [
                        'end_time'     => '17:00',
                        'is_available' => true,
                        'notes'        => 'Afternoon Clinic Duty',
                    ]
                );
            }
        }

        // Sample Student
        User::firstOrCreate(
            ['email' => 'student@clinic.local'],
            [
                'first_name' => 'Juan',
                'last_name' => 'Dela Cruz',
                'password' => \Illuminate\Support\Facades\Hash::make('password123'),
                'role_id' => 4,
                'role' => 'student',
                'student_id' => '2024-0001',
                'department' => 'College of Engineering',
            ]
        );

        // Sample Faculty
        User::firstOrCreate(
            ['email' => 'faculty@clinic.local'],
            [
                'title' => 'Prof.',
                'first_name' => 'Maria',
                'last_name' => 'Santos',
                'password' => \Illuminate\Support\Facades\Hash::make('password123'),
                'role_id' => 5,
                'role' => 'faculty_staff',
                'department' => 'College of Science',
            ]
        );

        // Clinic Services
        $services = [
            [
                'name' => 'Medical Consultation',
                'description' => 'General medical check-up and consultation with clinic physician.',
                'duration_minutes' => 30,
                'fee' => 0.00,
                'is_active' => true,
            ],
            [
                'name' => 'Dental Consultation',
                'description' => 'Comprehensive dental examination, oral health check-up, and dental advice.',
                'duration_minutes' => 45,
                'fee' => 0.00,
                'is_active' => true,
            ],
            [
                'name' => 'Dental Cleaning',
                'description' => 'Professional oral prophylaxis, scaling, and dental plaque/tartar removal.',
                'duration_minutes' => 30,
                'fee' => 0.00,
                'is_active' => true,
            ],
            [
                'name' => 'Tooth Extraction',
                'description' => 'Safe extraction and removal of damaged, decayed, or non-restorable teeth.',
                'duration_minutes' => 30,
                'fee' => 0.00,
                'is_active' => true,
            ],
            [
                'name' => 'Tooth Filling',
                'description' => 'Restoration of decayed or fractured teeth using durable dental filling materials.',
                'duration_minutes' => 30,
                'fee' => 0.00,
                'is_active' => true,
            ],
            [
                'name' => 'First Aid Treatment',
                'description' => 'Emergency first aid for minor injuries and wounds.',
                'duration_minutes' => 20,
                'fee' => 0.00,
                'is_active' => true,
            ],
            [
                'name' => 'Blood Pressure Monitoring',
                'description' => 'Regular blood pressure check and cardiovascular monitoring.',
                'duration_minutes' => 15,
                'fee' => 0.00,
                'is_active' => true,
            ],
            [
                'name' => 'Physical Examination',
                'description' => 'Comprehensive physical examination for clearance certificates.',
                'duration_minutes' => 60,
                'fee' => 0.00,
                'is_active' => true,
            ],
            [
                'name' => 'Issuance of Medical Certificate',
                'description' => 'Medical assessment and certificate for school, athletic, scholarship, or other valid purposes.',
                'duration_minutes' => 30,
                'fee' => 0.00,
                'is_active' => true,
            ],
        ];

        foreach ($services as $s) {
            \App\Models\ClinicService::firstOrCreate(
                ['name' => $s['name']],
                $s
            );
        }

        $this->call(InventorySeeder::class);
    }


}
