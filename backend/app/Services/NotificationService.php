<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Service to create notifications for announcements and calendar events.
 * Handles audience resolution, bulk insertion, and non‑blocking error handling.
 */
class NotificationService
{
    /**
     * Broadcast a notification to the appropriate audience.
     *
     * @param string $type          Notification type (info, warning, success, error)
     * @param string $title         Notification title
     * @param string $message       Notification message/body
     * @param string $audience      Audience identifier (All, Students, Staff, Faculty/Staff, Clinic Staff, Nurses, Dentists)
     * @param string|null $actionUrl URL to navigate when clicking the notification
     * @param int $creatorId       ID of the user who triggered the notification (to be excluded)
     */
    public static function announce(string $type, string $title, string $message, string $audience, ?string $actionUrl, int $creatorId): void
    {
        try {
            $audienceMap = [
                'All'           => ['student', 'clinic_staff', 'nurse', 'dentist', 'faculty_staff', 'admin'],
                'Students'      => ['student'],
                'Staff'         => ['faculty_staff', 'clinic_staff', 'nurse', 'dentist'],
                'Faculty/Staff' => ['faculty_staff'],
                'Clinic Staff'  => ['clinic_staff', 'nurse', 'dentist'],
                'Nurses'        => ['clinic_staff', 'nurse'],
                'Dentists'      => ['dentist'],
            ];

            $roles = $audienceMap[$audience] ?? $audienceMap['All'];

            $users = User::where(function($q) use ($roles) {
                    $q->whereIn('role', $roles)
                      ->orWhereHas('roleRelation', fn($rq) => $rq->whereIn('slug', $roles));
                })
                ->where('is_active', true)
                ->where('id', '!=', $creatorId)
                ->get();

            if ($users->isEmpty()) {
                return;
            }

            $now = now();
            $notifications = [];
            foreach ($users as $user) {
                $notifications[] = [
                    'user_id'    => $user->id,
                    'title'      => $title,
                    'message'    => $message,
                    'type'       => $type,
                    'is_read'    => false,
                    'action_url' => $actionUrl,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            Notification::insert($notifications);
        } catch (\Throwable $e) {
            Log::error('Failed to dispatch notification: ' . $e->getMessage(), [
                'type'     => $type,
                'title'    => $title,
                'audience' => $audience,
                'creator'  => $creatorId,
                'exception'=> $e,
            ]);
        }
    }
}
