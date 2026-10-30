<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AnnouncementsSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            [
                'title'      => 'Annual Physical Examination for College Students',
                'message'    => 'All 1st year and graduating students must undergo mandatory physical examinations this semester at the Main Clinic. Clinic hours: 8:00 AM – 5:00 PM.',
                'audience'   => 'Students',
                'created_by' => null,
                'created_at' => '2026-10-14 08:00:00',
                'updated_at' => '2026-10-14 08:00:00',
            ],
            [
                'title'      => 'Free Dental Cleaning & Fluoridation Month',
                'message'    => 'Free oral prophylaxis and dental assessment for all enrolled students at the Dental Clinic. Book a slot or consult on-site.',
                'audience'   => 'Students',
                'created_by' => null,
                'created_at' => '2026-10-10 09:00:00',
                'updated_at' => '2026-10-10 09:00:00',
            ],
            [
                'title'      => 'Campus Seasonal Flu Vaccination Drive',
                'message'    => 'Free seasonal influenza vaccines will be administered at the University Gymnasium. Present your valid FSUU student ID.',
                'audience'   => 'All',
                'created_by' => null,
                'created_at' => '2026-10-05 08:30:00',
                'updated_at' => '2026-10-05 08:30:00',
            ],
        ];

        foreach ($defaults as $data) {
            // Skip if already exists (match by title)
            if (Announcement::where('title', $data['title'])->exists()) {
                $this->command->info("Skipping (exists): {$data['title']}");
                continue;
            }

            $ann = Announcement::create($data);
            $this->command->info("Seeded: {$ann->title}");

            // Also backfill notifications for each seeded announcement
            $this->seedNotifications($ann);
        }
    }

    private function seedNotifications(Announcement $ann): void
    {
        try {
            $roles = match ($ann->audience) {
                'Students' => ['student'],
                'Staff'    => ['clinic_staff', 'dentist'],
                default    => ['student', 'clinic_staff', 'dentist', 'admin'],
            };

            $users = User::whereIn('role', $roles)
                ->where('is_active', true)
                ->get();

            if ($users->isEmpty()) {
                return;
            }

            $now  = now();
            $rows = [];
            foreach ($users as $user) {
                // Skip if notification already exists for this user+announcement
                $exists = Notification::where('type', 'announcement')
                    ->where('linked_id', $ann->id)
                    ->where('user_id', $user->id)
                    ->exists();

                if (!$exists) {
                    $rows[] = [
                        'user_id'    => $user->id,
                        'title'      => $ann->title,
                        'message'    => $ann->message,
                        'type'       => 'announcement',
                        'linked_id'  => $ann->id,
                        'is_read'    => false,
                        'action_url' => null,
                        'created_at' => $ann->created_at,
                        'updated_at' => $ann->created_at,
                    ];
                }
            }

            if (!empty($rows)) {
                Notification::insert($rows);
                $this->command->info("  -> Notified " . count($rows) . " users.");
            }
        } catch (\Throwable $e) {
            Log::error('[AnnouncementsSeeder] Notification backfill failed: ' . $e->getMessage());
            $this->command->warn("  -> Notifications failed (logged): " . $e->getMessage());
        }
    }
}
