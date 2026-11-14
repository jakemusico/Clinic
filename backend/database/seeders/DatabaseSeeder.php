<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /** Passwords generated for newly created accounts outside local: email => password. */
    private array $issuedPasswords = [];

    /**
     * Create a demo account unless it already exists.
     *
     * Local/testing: the well-known demo password. Anywhere else: a random password per account,
     * printed once at the end of the run, and the account must change it at first login.
     */
    private function seedUser(string $email, array $attributes): User
    {
        $password = SeedPassword::generate();

        $user = User::where('email', $email)->first();

        if (! $user) {
            // `role_id` and `must_change_password` are not mass-assignable: they are set one by one.
            $roleId = $attributes['role_id'] ?? null;
            unset($attributes['role'], $attributes['role_id']);

            $user = new User($attributes + ['email' => $email, 'password' => Hash::make($password)]);
            if ($roleId !== null) {
                $user->role_id = $roleId;
            }
            $user->must_change_password = ! SeedPassword::isLocal();

            // users.name has no default. The User model fills it while saving, but a seeder that runs without
            // model events would leave it empty and fail, so it is set here the same way the model does.
            $user->name = trim(($user->title ? $user->title . ' ' : '') . implode(' ', array_filter([
                $user->first_name, $user->middle_name, $user->last_name, $user->suffix,
            ], fn ($p) => $p !== null && trim($p) !== '')));
            $user->save();   // a freshly created model has wasRecentlyCreated = true
        }

        if ($user->wasRecentlyCreated && ! SeedPassword::isLocal()) {
            $this->issuedPasswords[$email] = $password;
        }

        return $user;
    }

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Seed default roles
        $roles = [
            ['id' => 1, 'name' => 'Admin', 'slug' => 'admin', 'description' => 'System Administrator with full management access'],
            // slug is 'clinic_staff' (what the users.role column and the roles table use); the role is called "Nurse"
            ['id' => 2, 'name' => 'Nurse', 'slug' => 'clinic_staff', 'description' => 'Clinic Nurse and Health Personnel'],
            ['id' => 3, 'name' => 'Dentist', 'slug' => 'dentist', 'description' => 'Clinic Dental Health Professional'],
            ['id' => 4, 'name' => 'Student', 'slug' => 'student', 'description' => 'Enrolled Student Patient'],
            ['id' => 5, 'name' => 'Faculty / Staff', 'slug' => 'faculty_staff', 'description' => 'University Faculty or Non-Teaching Staff Patient'],
        ];

        foreach ($roles as $r) {
            \App\Models\Role::updateOrCreate(['id' => $r['id']], $r);
        }

        // Admin
        $this->seedUser('admin@clinic.local', [
            'first_name' => 'System',
            'last_name' => 'Administrator',
            'role_id' => 1,
        ]);

        // Clinic Staff (Nurse)
        $nurse = $this->seedUser('nurse@clinic.local', [
            'title' => 'Nurse',
            'first_name' => 'Nurse',
            'last_name' => 'Joy',
            'role_id' => 2,
        ]);

        // Dentist
        $dentist = $this->seedUser('dentist@clinic.local', [
            'title' => 'Dr.',
            'first_name' => 'Arthur',
            'last_name' => 'Dent',
            'role_id' => 3,
        ]);

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
        $this->seedUser('student@clinic.local', [
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'role_id' => 4,
            'student_id' => '2024-0001',
            'department' => 'College of Engineering',
        ]);

        // Sample Faculty
        $this->seedUser('faculty@clinic.local', [
            'title' => 'Prof.',
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'role_id' => 5,
            'department' => 'College of Science',
        ]);

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
            // medical (nurse) or dental (dentist) care; dental services are recognised by their name
            $s['care_type'] = preg_match('/dental|tooth|teeth|oral|gum|extraction|dentist/i', $s['name']) === 1 ? 'dental' : 'medical';

            \App\Models\ClinicService::firstOrCreate(
                ['name' => $s['name']],
                $s
            );
        }

        $this->call(InventorySeeder::class);

        $this->reportIssuedPasswords();
    }

    /** Show the generated passwords once. They are stored hashed, so they cannot be shown again. */
    private function reportIssuedPasswords(): void
    {
        if (! $this->issuedPasswords || ! $this->command) {
            return;
        }

        $this->command->warn('Demo accounts were created with RANDOM passwords (not password123). Save them now, they are not stored anywhere:');
        $this->command->table(
            ['Email', 'Password'],
            array_map(fn ($email, $password) => [$email, $password], array_keys($this->issuedPasswords), $this->issuedPasswords)
        );
        $this->command->warn('Each account must change its password at first login. Consider deleting these demo accounts in production.');
    }


}
