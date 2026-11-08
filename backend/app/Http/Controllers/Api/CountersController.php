<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\SystemSetting;
use App\Support\CacheVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * GET /api/counters
 *
 * Everything the page header and the chat bubble show as a badge, in ONE request: unread
 * notifications (plus the 5 newest for the bell menu), unread appointment requests (staff),
 * and unread chat messages. It replaces four separate polled requests
 * (notifications, appointments/unread-count, chat/unread-count, chat/student/unread-count).
 *
 * It only READS. (The admins' low-stock / expiry alerts are no longer generated here: see the
 * `inventory:sync-alerts` scheduled command and AppServiceProvider.)
 *
 * The answer is cached for 15 seconds PER USER. The key holds the user id and role, and the versions
 * of what the badges count (the user's own notifications, chat messages, appointments): reading or
 * receiving one of those starts a new version, so a badge never lags behind the user's own action.
 */
class CountersController extends Controller
{
    private const TTL = 15;

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        $key = CacheVersion::key(
            "counters:{$user->id}",
            'u' . $user->id,
            'r' . $user->role,
            'chat' . CacheVersion::get('counters-chat'),
            'appt' . CacheVersion::get('counters-appointments'),
            'cfg' . CacheVersion::get('settings'),
        );

        $payload = Cache::remember($key, self::TTL, fn () => $this->build($request));

        return response()->json($payload);
    }

    private function build(Request $request): array
    {
        $user = $request->user();

        // Notifications: same visibility rules as the Notifications page
        $notifications = NotificationController::visibleQuery($user);
        $unreadNotifications = (clone $notifications)->where('is_read', false)->count();
        $recentNotifications = NotificationController::recent($notifications, 5);

        return [
            'notifications' => [
                'unread_count' => $unreadNotifications,
                'recent'       => $recentNotifications,
            ],
            'appointments' => $this->appointmentCounts($user->role),
            'chat' => [
                'unread_count' => $this->chatUnread($request),
                'enabled'      => SystemSetting::getValue('chat_enabled') !== '0',
            ],
        ];
    }

    /** Unread appointment requests per kind of care, for the roles that manage them. */
    private function appointmentCounts(string $role): array
    {
        $counts = ['unread_count' => 0, 'medical_unread_count' => 0, 'dental_unread_count' => 0];

        if (! in_array($role, ['clinic_staff', 'dentist', 'admin'], true)) {
            return $counts;
        }

        $byType = Appointment::where('is_read', false)
            ->whereIn('appointment_type', ['medical', 'dental'])
            ->selectRaw('appointment_type, COUNT(*) AS c')
            ->groupBy('appointment_type')
            ->pluck('c', 'appointment_type');

        // The nurse only sees medical requests and the dentist only dental ones; admin sees both.
        $counts['medical_unread_count'] = $role === 'dentist' ? 0 : (int) ($byType['medical'] ?? 0);
        $counts['dental_unread_count'] = $role === 'clinic_staff' ? 0 : (int) ($byType['dental'] ?? 0);
        $counts['unread_count'] = $counts['medical_unread_count'] + $counts['dental_unread_count'];

        return $counts;
    }

    /**
     * Unread chat messages: staff see replies waiting in their queue, students and faculty see
     * unread staff replies. Reuses the chat controller so the rules stay in one place.
     */
    private function chatUnread(Request $request): int
    {
        $chat = app(ChatController::class);
        $user = $request->user();

        $response = in_array($user->role, ['student', 'faculty_staff'], true)
            ? $chat->getStudentUnreadCount($request)
            : $chat->getUnreadCount($request);

        return (int) ($response->getData(true)['unread_count'] ?? 0);
    }
}
