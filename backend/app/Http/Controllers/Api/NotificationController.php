<?php

namespace App\Http\Controllers\Api;

use App\Support\CacheVersion;
use App\Support\Paging;
use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class NotificationController extends Controller
{
    /** Newest notifications returned when the caller does not paginate (keeps the payload bounded). */
    private const DEFAULT_LIMIT = 200;
    private const MAX_LIMIT = 500;

    /**
     * The notifications a user can see. Nurses and dentists keep chat notifications out of the
     * bell, the bell count and the Notifications page. Shared by the list and the header counters
     * so both always agree.
     */
    public static function visibleQuery(\App\Models\User $user)
    {
        $query = Notification::where('user_id', $user->id);

        if ($user->isClinicStaff() || $user->isDentist()) {
            $query->where(function ($q) {
                $q->whereNull('target_type')
                  ->orWhere('target_type', '!=', 'conversation');
            })
            ->where(function ($q) {
                $q->whereNull('action_url')
                  ->orWhere('action_url', 'not like', '%/clinic/messages%');
            })
            ->where('title', 'not like', 'New message from%');
        }

        return $query;
    }

    /**
     * The newest $limit notifications, unread ones first. Done as two index-friendly queries
     * (unread newest-first, then read newest-first) instead of one "ORDER BY is_read, created_at
     * DESC", which MySQL can only answer by sorting every notification the user has ever had.
     */
    public static function recent($visibleQuery, int $limit)
    {
        $unread = (clone $visibleQuery)->where('is_read', false)->orderByDesc('created_at')->limit($limit)->get();

        if ($unread->count() >= $limit) {
            return $unread;
        }

        $read = (clone $visibleQuery)->where('is_read', true)->orderByDesc('created_at')->limit($limit - $unread->count())->get();

        return $unread->concat($read)->values();
    }

    /**
     * GET /api/notifications
     * Retrieve the notifications of the authenticated user (newest 200 unless paginated).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = self::visibleQuery($user);

        $unreadCount = (clone $query)->where('is_read', false)->count();

        if ($request->has('page') || $request->has('per_page')) {
            $perPage = Paging::perPage($request);
            $paginated = $query
                ->orderBy('is_read', 'asc')
                ->orderBy('created_at', 'desc')
                ->paginate($perPage);

            return response()->json([
                'notifications' => $paginated->items(),
                'data'          => $paginated->items(),
                'current_page'  => $paginated->currentPage(),
                'last_page'     => $paginated->lastPage(),
                'per_page'      => $paginated->perPage(),
                'total'         => $paginated->total(),
                'from'          => $paginated->firstItem(),
                'to'            => $paginated->lastItem(),
                'unread_count'  => $unreadCount,
            ]);
        }

        $limit = min(self::MAX_LIMIT, max(1, (int) $request->input('limit', self::DEFAULT_LIMIT)));

        $notifications = self::recent($query, $limit); // unread first, then newest

        return response()->json([
            'notifications' => $notifications,
            'data'          => $notifications,
            'total'         => $notifications->count(),
            'unread_count'  => $unreadCount,
        ]);
    }

    /**
     * GET /api/notifications/poll?since=<id>
     * Lightweight endpoint for the frontend's fast poll (every few seconds): returns only the
     * notifications newer than `since` plus the current unread count, so a tick costs almost
     * nothing. Same visibility rules as index() — a user only ever sees their own notifications.
     */
    public function poll(Request $request): JsonResponse
    {
        $user = $request->user();
        $since = max(0, (int) $request->query('since', 0));

        $visible = self::visibleQuery($user);

        $unreadCount = (clone $visible)->where('is_read', false)->count();

        $items = (clone $visible)
            ->where('id', '>', $since)
            ->orderByDesc('id')
            ->limit(20)
            ->get();

        // Cursor is over ALL of the user's notifications (not just visible ones) so a hidden
        // notification can never stall it — the id sequence only moves forward.
        $latestId = (int) (Notification::where('user_id', $user->id)->max('id') ?? 0);

        return response()->json([
            'unread_count'  => $unreadCount,
            'latest_id'     => $latestId,
            'notifications' => $items,
            'data'          => $items,
        ]);
    }

    /**
     * PATCH /api/notifications/{notification}/read
     * Mark a single notification as read.
     */
    public function markAsRead(Request $request, Notification $notification): JsonResponse
    {
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $notification->update(['is_read' => true]);

        return response()->json([
            'message'      => 'Notification marked as read.',
            'notification' => $notification,
        ]);
    }

    /**
     * PATCH /api/notifications/{notification}/unread
     * Mark a single notification as unread.
     */
    public function markAsUnread(Request $request, Notification $notification): JsonResponse
    {
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $notification->update(['is_read' => false]);

        return response()->json([
            'message'      => 'Notification marked as unread.',
            'notification' => $notification,
        ]);
    }

    /**
     * DELETE /api/notifications/{notification}
     * Delete a notification for the current user.
     */
    public function destroy(Request $request, Notification $notification): JsonResponse
    {
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $notification->delete();

        return response()->json([
            'message' => 'Notification deleted successfully.',
        ]);
    }

    /**
     * POST /api/notifications/read-all
     * Mark all notifications as read.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Notification::where('user_id', $user->id)
            ->where('is_read', false);

        if ($user->isClinicStaff() || $user->isDentist()) {
            $query->where(function ($q) {
                $q->whereNull('target_type')
                  ->orWhere('target_type', '!=', 'conversation');
            })
            ->where(function ($q) {
                $q->whereNull('action_url')
                  ->orWhere('action_url', 'not like', '%/clinic/messages%');
            })
            ->where('title', 'not like', 'New message from%');
        }

        $query->update(['is_read' => true]);
        CacheVersion::bump("counters:{$user->id}");   // a bulk update fires no model events

        return response()->json([
            'message' => 'All notifications marked as read.',
        ]);
    }

    /**
     * POST /api/notifications/announce
     * Broadcast a clinic-wide announcement notification to all active users.
     * Restricted to admin and clinic_staff.
     */
    public function announce(Request $request): JsonResponse
    {
        $sender = $request->user();

        if (! in_array($sender->role, ['admin', 'clinic_staff'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
    'title'   => ['required', 'string', 'max:150'],
    'message' => ['required', 'string', 'max:1000'],
    'type'    => ['required', 'string', 'in:info,warning,success,error'],
    'audience'=> ['required', 'string', 'in:All,Students,Staff,Faculty/Staff,Clinic Staff,Nurses,Dentists'],
]);

// Use shared NotificationService to broadcast to audience, excluding creator
\App\Services\NotificationService::announce(
    $validated['type'],
    $validated['title'],
    $validated['message'],
    $validated['audience'],
    null,
    $sender->id
);

        return response()->json([
            'message' => 'Announcement broadcasted successfully to selected audience.',
        ], 201);
    }

    /**
     * GET /api/admin/notifications/{notification}/target
     * Verify whether the target record exists and resolve the target link/data for an admin notification.
     */
    public function resolveTarget(Request $request, Notification $notification): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'admin' || $notification->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $type = $notification->target_type;
        $id   = $notification->target_id;

        // Fallback deduction if target_type is not yet explicitly set
        if (!$type) {
            if ($notification->type === 'announcement' || $notification->linked_id) {
                $type = 'announcement';
                $id   = $notification->linked_id;
            } elseif ($notification->action_url === '/calendar') {
                $type = 'calendar_event';
                $id   = $notification->linked_id;
            } elseif (stripos($notification->title, 'Stock') !== false || stripos($notification->title, 'Expired') !== false || stripos($notification->title, 'Expiring') !== false) {
                $type = 'inventory_item';
            } elseif (stripos($notification->title, 'User') !== false) {
                $type = 'user';
            }
        }

        if ($type === 'inventory_item') {
            if ($id) {
                $item = \App\Models\InventoryItem::find($id);
                if (!$item) {
                    return response()->json([
                        'exists'  => false,
                        'message' => 'This inventory item no longer exists.',
                    ]);
                }
                return response()->json([
                    'exists'     => true,
                    'type'       => 'inventory_item',
                    'action_url' => '/clinic/inventory/items?search=' . urlencode($item->name),
                ]);
            }
            return response()->json([
                'exists'     => true,
                'type'       => 'inventory_dashboard',
                'action_url' => '/clinic/inventory',
            ]);
        }

        if ($type === 'user') {
            if ($id) {
                $u = \App\Models\User::find($id);
                if (!$u) {
                    return response()->json([
                        'exists'  => false,
                        'message' => 'This user account no longer exists.',
                    ]);
                }
                return response()->json([
                    'exists'     => true,
                    'type'       => 'user',
                    'action_url' => '/admin/users?search=' . urlencode($u->name),
                ]);
            }
            return response()->json([
                'exists'     => true,
                'type'       => 'user',
                'action_url' => '/admin/users',
            ]);
        }

        if ($type === 'announcement') {
            if ($id) {
                $ann = \App\Models\Announcement::find($id);
                if (!$ann) {
                    return response()->json([
                        'exists'  => false,
                        'message' => 'This announcement no longer exists.',
                    ]);
                }
                return response()->json([
                    'exists'       => true,
                    'type'         => 'announcement',
                    'announcement' => $ann,
                ]);
            }
            return response()->json([
                'exists'       => true,
                'type'         => 'announcement',
                'announcement' => $notification,
            ]);
        }

        if ($type === 'calendar_event') {
            if ($id) {
                $evt = \App\Models\CalendarEvent::find($id);
                if (!$evt) {
                    return response()->json([
                        'exists'  => false,
                        'message' => 'This event no longer exists.',
                    ]);
                }
                return response()->json([
                    'exists' => true,
                    'type'   => 'calendar_event',
                    'event'  => $evt,
                ]);
            }
            return response()->json([
                'exists' => true,
                'type'   => 'calendar_event',
                'event'  => $notification,
            ]);
        }

        // Generic fallback URL if any
        if ($notification->action_url) {
            return response()->json([
                'exists'     => true,
                'type'       => 'url',
                'action_url' => $notification->action_url,
            ]);
        }

        return response()->json([
            'exists'  => true,
            'type'    => 'none',
            'message' => null,
        ]);
    }
}
