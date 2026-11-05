<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GET /api/counters
 *
 * Everything the page header and the chat bubble show as a badge, in ONE request: unread
 * notifications (plus the 5 newest for the bell menu), unread appointment requests (staff),
 * and unread chat messages. It replaces four separate polled requests
 * (notifications, appointments/unread-count, chat/unread-count, chat/student/unread-count).
 */
class CountersController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        // Notifications: same visibility rules as the Notifications page
        NotificationController::syncAdminAlerts($user);
        $notifications = NotificationController::visibleQuery($user);
        $unreadNotifications = (clone $notifications)->where('is_read', false)->count();
        $recentNotifications = NotificationController::recent($notifications, 5);

        return response()->json([
            'notifications' => [
                'unread_count' => $unreadNotifications,
                'recent'       => $recentNotifications,
            ],
            'appointments' => $this->appointmentCounts($user->role),
            'chat' => [
                'unread_count' => $this->chatUnread($request),
                'enabled'      => SystemSetting::getValue('chat_enabled') !== '0',
            ],
        ]);
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
