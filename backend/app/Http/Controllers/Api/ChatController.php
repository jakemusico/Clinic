<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClinicStaffSchedule;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Notification;
use App\Models\SystemSetting;
use App\Models\User;
use App\Support\CacheVersion;
use App\Support\Paging;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class ChatController extends Controller
{
    /**
     * Map authenticated staff user to their chat role ('nurse' or 'dentist').
     */
    protected function getStaffRole(User $user): ?string
    {
        if ($user->isClinicStaff()) {
            return 'nurse';
        }
        if ($user->isDentist()) {
            return 'dentist';
        }
        return null;
    }

    /**
     * Check if the user is authorized to view or send in this conversation.
     * Enforce Rule 6: Admin has no access. Only student/faculty and the staff role.
     */
    protected function authorizeConversation(User $user, Conversation $conversation): bool
    {
        if ($user->isAdmin()) {
            return false;
        }

        if ($user->isStudent() || $user->role === 'faculty_staff') {
            return (int) $conversation->student_id === (int) $user->id;
        }

        $staffRole = $this->getStaffRole($user);
        if ($staffRole) {
            return $conversation->staff_role === $staffRole;
        }

        return false;
    }

    /** Most messages one response carries; older ones are fetched with ?before=<message id>. */
    private const MESSAGE_PAGE = 200;

    /** Most conversations a staff list returns when the caller does not page. */
    private const CONVERSATION_LIST_LIMIT = 300;

    private const SENDER_COLUMNS = 'sender:id,name,first_name,middle_name,last_name,suffix,title,role,avatar';

    /**
     * Put the newest MESSAGE_PAGE messages of a conversation on it (oldest first, soft-deleted "unsent"
     * ones included), instead of loading the whole thread. With ?before=<message id> the page that ends
     * just before that message is returned (cursor paging).
     *
     * Adds messages_has_more (older messages exist) and messages_next_cursor (pass it as ?before=).
     */
    protected function loadMessagePage(Conversation $conversation, ?int $before = null): void
    {
        $rows = Message::withTrashed()
            ->where('conversation_id', $conversation->id)
            ->when($before, fn ($q) => $q->where('id', '<', $before))
            ->with(self::SENDER_COLUMNS)
            ->orderByDesc('id')
            ->limit(self::MESSAGE_PAGE + 1)
            ->get();

        $more = $rows->count() > self::MESSAGE_PAGE;
        $page = $rows->take(self::MESSAGE_PAGE)->reverse()->values();

        $conversation->setRelation('messages', $page);
        $conversation->setAttribute('messages_has_more', $more);
        $conversation->setAttribute('messages_next_cursor', $more ? $page->first()?->id : null);
    }

    /**
     * Lazily auto-resolve conversations with no activity in 7+ days.
     */
    protected function autoResolveStale(): void
    {
        // Two polled endpoints call this. The table-wide UPDATE is needed at most once a minute (a conversation
        // is resolved after DAYS of silence, so a minute's delay is invisible); Cache::add lets one request in.
        if (! Cache::add('chat:auto-resolve-stale', 1, 60)) {
            return;
        }

        $days = (int) SystemSetting::getValue('chat_auto_resolve_days', 7);
        if ($days <= 0) {
            $days = 7;
        }

        Conversation::where('status', 'open')
            ->where(function ($q) use ($days) {
                $q->where('last_message_at', '<', now()->subDays($days))
                  ->orWhere(function ($sub) use ($days) {
                      $sub->whereNull('last_message_at')
                          ->where('updated_at', '<', now()->subDays($days));
                  });
            })
            ->update(['status' => 'resolved']);
    }

    /**
     * GET /api/chat/status/{staff_role}
     * Check if a staff of that role is within Staff Schedules now AND active within 2 minutes.
     */
    public function getStatus(string $staff_role): JsonResponse
    {
        $role = strtolower($staff_role);
        if (!in_array($role, ['nurse', 'dentist'])) {
            return response()->json(['message' => 'Invalid staff role.'], 422);
        }

        $now = Carbon::now('Asia/Manila');
        $currentDay = strtolower($now->format('l')); // e.g. monday
        $currentTime = $now->format('H:i:s');

        // Find user IDs corresponding to this role
        if ($role === 'nurse') {
            $staffUsers = User::where(function ($q) {
                $q->whereIn('role', ['clinic_staff', 'nurse'])
                  ->orWhereHas('roleRelation', fn($rq) => $rq->whereIn('slug', ['clinic_staff', 'nurse']));
            })->where('is_active', true)->get();
        } else {
            $staffUsers = User::where(function ($q) {
                $q->where('role', 'dentist')
                  ->orWhereHas('roleRelation', fn($rq) => $rq->where('slug', 'dentist'));
            })->where('is_active', true)->get();
        }

        $staffUserIds = $staffUsers->pluck('id');

        // Check schedule
        $withinSchedule = false;
        if ($staffUserIds->isNotEmpty()) {
            $withinSchedule = ClinicStaffSchedule::whereIn('user_id', $staffUserIds)
                ->where('day_of_week', $currentDay)
                ->where('is_available', true)
                ->where('start_time', '<=', $currentTime)
                ->where('end_time', '>=', $currentTime)
                ->exists();
        }

        // Check last_active_at within 2 minutes
        $activeRecently = false;
        if ($withinSchedule && $staffUsers->isNotEmpty()) {
            $twoMinutesAgo = now()->subMinutes(2);
            $activeRecently = $staffUsers->contains(function ($u) use ($twoMinutesAgo) {
                return $u->last_active_at && $u->last_active_at->gte($twoMinutesAgo);
            });
        }

        $isOnline = $withinSchedule && $activeRecently;

        // Clinic Info for hotline and clinic hours
        $clinicInfoRaw = SystemSetting::getValue('clinic_info');
        $clinicInfo = $clinicInfoRaw ? json_decode($clinicInfoRaw, true) : [];

        $hotline = $clinicInfo['contact_mobile'] ?? $clinicInfo['contact_trunkline'] ?? '(085) 342-1830 local 124';

        // Find online staff name
        $onlineStaffName = null;
        if ($isOnline) {
            $twoMinutesAgo = now()->subMinutes(2);
            $onlineStaff = $staffUsers->first(function ($u) use ($twoMinutesAgo) {
                return $u->last_active_at && $u->last_active_at->gte($twoMinutesAgo);
            });
            if ($onlineStaff) {
                $onlineStaffName = $onlineStaff->name;
            }
        }

        // Format hours summary
        $hoursSummary = 'Mon - Fri: 8:00 AM - 5:00 PM';
        if (!empty($clinicInfo['schedule']) && is_array($clinicInfo['schedule'])) {
            $openDays = [];
            $commonHours = '';
            foreach ($clinicInfo['schedule'] as $sched) {
                if (!empty($sched['is_open'])) {
                    $openDays[] = substr($sched['day'] ?? '', 0, 3);
                    if (!$commonHours && !empty($sched['open_time']) && !empty($sched['close_time'])) {
                        $open = Carbon::createFromTimeString($sched['open_time'])->format('g:i A');
                        $close = Carbon::createFromTimeString($sched['close_time'])->format('g:i A');
                        $commonHours = "$open - $close";
                    }
                }
            }
            if (!empty($openDays)) {
                $first = $openDays[0];
                $last = end($openDays);
                $daysRange = count($openDays) > 1 ? "$first - $last" : $first;
                $hoursSummary = "$daysRange: " . ($commonHours ?: '8:00 AM - 5:00 PM');
            }
        }

        // Check chat enabled (default true)
        $chatEnabled = SystemSetting::getValue('chat_enabled') !== '0';

        // Offline message
        $offlineMessage = SystemSetting::getValue('chat_offline_message') ?: null;

        return response()->json([
            'staff_role'      => $role,
            'is_online'       => $isOnline,
            'clinic_hotline'  => $hotline,
            'clinic_hours'    => $hoursSummary,
            'staff_name'      => $onlineStaffName,
            'chat_enabled'    => $chatEnabled,
            'offline_message' => $offlineMessage,
        ]);
    }

    /**
     * POST /api/chat/heartbeat
     * Staff-only ping to keep last_active_at fresh every 45 seconds.
     */
    public function heartbeat(Request $request): JsonResponse
    {
        $user = $request->user();
        $staffRole = $this->getStaffRole($user);
        if (!$staffRole) {
            return response()->json(['ok' => false], 403);
        }

        $user->update(['last_active_at' => now()]);

        return response()->json(['ok' => true]);
    }

    /**
     * GET /api/chat/student/conversation
     * Find or create conversation for the logged-in student/faculty with the given staff_role.
     */
    public function getStudentConversation(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isStudent() && $user->role !== 'faculty_staff') {
            return response()->json(['message' => 'Only students and faculty/staff can access this endpoint.'], 403);
        }

        $staffRole = strtolower($request->query('staff_role', 'nurse'));
        if (!in_array($staffRole, ['nurse', 'dentist'])) {
            return response()->json(['message' => 'Invalid staff role.'], 422);
        }

        // Lazy auto-resolve stale conversations
        $this->autoResolveStale();

        // One thread per student and team. With the unique index on (student_id, staff_role), two requests
        // at the same moment get the same thread (firstOrCreate reads the winner's row when its insert loses).
        $conversation = Conversation::firstOrCreate(
            [
                'student_id' => $user->id,
                'staff_role' => $staffRole,
            ],
            [
                'status'     => 'open',
                'last_message_at' => now(),
            ]
        );

        // Mark any unread messages from staff as read
        Message::where('conversation_id', $conversation->id)
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->whereNull('deleted_at')
            ->update(['read_at' => now()]);
        CacheVersion::bump('counters-chat');   // a bulk update fires no model events

        $this->loadMessagePage($conversation, $request->integer('before') ?: null);

        return response()->json($conversation);
    }

    /**
     * GET /api/chat/student/unread-count
     * Unread staff replies for the student/faculty's Help Assistant bubble badge.
     */
    public function getStudentUnreadCount(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isStudent() && $user->role !== 'faculty_staff') {
            return response()->json(['unread_count' => 0]);
        }

        $count = Message::whereHas('conversation', function ($q) use ($user) {
            $q->where('student_id', $user->id);
        })
        ->where('sender_id', '!=', $user->id)
        ->whereNull('read_at')
        ->whereNull('deleted_at')
        ->count();

        return response()->json(['unread_count' => $count]);
    }

    /**
     * POST /api/chat/student/read-all
     * Mark all unread staff replies to the student/faculty as read when chat is opened.
     */
    public function markStudentAllRead(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->isStudent() || $user->role === 'faculty_staff') {
            Message::whereHas('conversation', function ($q) use ($user) {
                $q->where('student_id', $user->id);
            })
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->whereNull('deleted_at')
            ->update(['read_at' => now()]);
        CacheVersion::bump('counters-chat');   // a bulk update fires no model events
        }

        return response()->json(['ok' => true]);
    }

    /**
     * GET /api/chat/conversations
     * List conversations for staff (nurse or dentist).
     */
    public function listConversations(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->isAdmin()) {
            return response()->json(['message' => 'Admins do not have access to live conversations.'], 403);
        }

        $staffRole = $this->getStaffRole($user);
        if (!$staffRole) {
            return response()->json(['message' => 'Only nurse and dentist staff can access conversations.'], 403);
        }

        // Lazy auto-resolve stale conversations
        $this->autoResolveStale();

        $status = $request->query('status'); // 'open' or 'resolved'

        $query = Conversation::where('staff_role', $staffRole)
            ->with([
                'student:id,name,title,first_name,middle_name,last_name,suffix,role,role_id,department,grade_level,section,avatar',
                'latestMessage',
            ])
            ->withCount([
                'messages as unread_count' => function ($q) use ($user) {
                    $q->where('sender_id', '!=', $user->id)
                      ->whereNull('read_at')
                      ->whereNull('deleted_at');
                },
            ]);

        if (in_array($status, ['open', 'resolved'])) {
            $query->where('status', $status);
        }

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->whereHas('student', function ($sq) use ($search) {
                $sq->where('name', 'like', $search)
                   ->orWhere('first_name', 'like', $search)
                   ->orWhere('last_name', 'like', $search)
                   ->orWhere('student_id', 'like', $search);
            });
        }

        if ($request->has('page') || $request->has('per_page')) {
            $perPage = Paging::perPage($request);
            $paginated = $query->orderByRaw('CASE WHEN last_message_at IS NULL THEN 1 ELSE 0 END')
                ->orderBy('last_message_at', 'desc')
                ->orderBy('updated_at', 'desc')
                ->paginate($perPage);

            return response()->json([
                'conversations' => $paginated->items(),
                'data'          => $paginated->items(),
                'current_page'  => $paginated->currentPage(),
                'last_page'     => $paginated->lastPage(),
                'per_page'      => $paginated->perPage(),
                'total'         => $paginated->total(),
                'from'          => $paginated->firstItem(),
                'to'            => $paginated->lastItem(),
            ]);
        }

        $conversations = $query->orderByRaw('CASE WHEN last_message_at IS NULL THEN 1 ELSE 0 END')
            ->orderBy('last_message_at', 'desc')
            ->orderBy('updated_at', 'desc')
            ->limit(self::CONVERSATION_LIST_LIMIT)
            ->get();

        return response()->json($conversations);
    }

    /**
     * GET /api/chat/conversations/{conversation}
     * Get a specific conversation and its messages.
     */
    public function showConversation(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $request->user();
        if (!$this->authorizeConversation($user, $conversation)) {
            return response()->json(['message' => 'Unauthorized to access this conversation.'], 403);
        }

        // Mark unread messages sent by others as read
        Message::where('conversation_id', $conversation->id)
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->whereNull('deleted_at')
            ->update(['read_at' => now()]);
        CacheVersion::bump('counters-chat');   // a bulk update fires no model events

        $conversation->load([
            'student:id,name,title,first_name,middle_name,last_name,suffix,role,role_id,department,grade_level,section,avatar',
        ]);
        $this->loadMessagePage($conversation, $request->integer('before') ?: null);

        return response()->json($conversation);
    }

    /**
     * POST /api/chat/conversations/{conversation}/messages
     * Send a text message (max 500 chars, block empty).
     */
    public function sendMessage(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $request->user();
        if (!$this->authorizeConversation($user, $conversation)) {
            return response()->json(['message' => 'Unauthorized to send message in this conversation.'], 403);
        }

        $validated = $request->validate([
            'body'      => ['required', 'string', 'max:500'],
            'client_id' => ['nullable', 'string', 'max:64'],
        ]);

        $body = trim($validated['body']);
        if ($body === '') {
            return response()->json(['message' => 'Message cannot be empty.'], 422);
        }

        // Idempotency: if message with this client_id already exists for this sender, return it
        $clientId = $validated['client_id'] ?? null;
        if ($clientId) {
            $existing = Message::withTrashed()
                ->where('client_id', $clientId)
                ->where('sender_id', $user->id)
                ->first();
            if ($existing) {
                $existing->load('sender:id,name,first_name,middle_name,last_name,suffix,title,role,avatar');
                return response()->json([
                    'message'      => $existing,
                    'conversation' => $conversation->fresh([
                        'student:id,name,title,first_name,middle_name,last_name,suffix,role,role_id,department,grade_level,section,avatar',
                    ]),
                ], 200);
            }
        }

        // Spam control: minimum 2 seconds between messages
        $lastMsg = Message::where('conversation_id', $conversation->id)
            ->where('sender_id', $user->id)
            ->orderByDesc('created_at')
            ->first();

        if ($lastMsg && $lastMsg->created_at->diffInSeconds(now()) < 2) {
            return response()->json(['message' => 'Please wait a moment before sending another message.'], 429);
        }

        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_id'       => $user->id,
            'client_id'       => $clientId ?: null,
            'body'            => $body,
            'edited_at'       => null,
        ]);

        // If student/faculty sends a message to a resolved conversation, reopen it
        if (($user->isStudent() || $user->role === 'faculty_staff') && $conversation->status === 'resolved') {
            $conversation->status = 'open';
        }
        $conversation->last_message_at = now();
        $conversation->save();

        // Notification Dispatch (Rule 5)
        // A new message notifies the staff role; a reply notifies the student/faculty.
        // Clicking the notification opens the conversation.
        try {
            if ($user->isStudent() || $user->role === 'faculty_staff') {
                // NURSE and DENTIST side:
                // Stop creating "New message from [student/faculty]" notifications.
                // Nurse and Dentist rely on the Messages sidebar item badge and conversation unread indicator.
            } else {
                // Reply sent by staff -> Notify student/faculty
                $roleLabel = $conversation->staff_role === 'dentist' ? 'Dentist' : 'Nurse';
                $snippet = Str::limit($body, 90);

                Notification::create([
                    'user_id'     => $conversation->student_id,
                    'title'       => "New reply from {$roleLabel}",
                    'message'     => $snippet,
                    'type'        => 'info',
                    'target_type' => 'conversation',
                    'target_id'   => $conversation->id,
                    'action_url'  => "/?chat={$conversation->staff_role}",
                    'is_read'     => false,
                ]);
            }
        } catch (\Throwable $e) {
            \Log::error('Chat notification error: ' . $e->getMessage());
        }

        $message->load('sender:id,name,first_name,middle_name,last_name,suffix,title,role,avatar');

        return response()->json([
            'message'      => $message,
            'conversation' => $conversation->fresh([
                'student:id,name,title,first_name,middle_name,last_name,suffix,role,role_id,department,grade_level,section,avatar',
            ]),
        ], 201);
    }

    /**
     * PATCH /api/chat/messages/{message}
     * Update (edit) a message body by its sender only.
     */
    public function updateMessage(Request $request, Message $message): JsonResponse
    {
        $user = $request->user();

        if ((int) $message->sender_id !== (int) $user->id) {
            return response()->json(['message' => 'You can only edit your own messages.'], 403);
        }

        if ($message->deleted_at !== null) {
            return response()->json(['message' => 'Cannot edit a removed message.'], 422);
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:500'],
        ]);

        $body = trim($validated['body']);
        if ($message->created_at && $message->created_at->lt(now()->subMinutes(15))) {
            return response()->json(['message' => 'Messages can only be edited within 15 minutes of sending.'], 422);
        }

        $message->update([
            'body'      => $body,
            'edited_at' => now(),
        ]);

        return response()->json([
            'message' => 'Message updated successfully.',
            'data'    => $message->fresh(['sender:id,name,first_name,middle_name,last_name,suffix,title,role,avatar']),
        ]);
    }

    /**
     * DELETE /api/chat/messages/{message}
     * Soft-delete (unsend) a message by its sender only.
     */
    public function unsendMessage(Request $request, Message $message): JsonResponse
    {
        $user = $request->user();

        if ((int) $message->sender_id !== (int) $user->id) {
            return response()->json(['message' => 'You can only unsend your own messages.'], 403);
        }

        if ($message->trashed()) {
            return response()->json(['message' => 'Message already removed.'], 409);
        }

        $message->delete();

        return response()->json(['id' => $message->id, 'deleted_at' => $message->deleted_at, 'body' => null]);
    }

    /**
     * PATCH /api/chat/conversations/{conversation}/status
     * Mark conversation as resolved or open (staff only).
     */
    public function updateStatus(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $request->user();
        if ($user->isAdmin() || $user->isStudent() || $user->role === 'faculty_staff') {
            return response()->json(['message' => 'Only clinic staff can update conversation status.'], 403);
        }

        $staffRole = $this->getStaffRole($user);
        if (!$staffRole || $conversation->staff_role !== $staffRole) {
            return response()->json(['message' => 'Unauthorized to update this conversation.'], 403);
        }

        $validated = $request->validate([
            'status' => ['required', 'in:open,resolved'],
        ]);

        $conversation->status = $validated['status'];
        $conversation->save();

        return response()->json($conversation);
    }

    /**
     * GET /api/chat/unread-count
     * Total unread messages for staff badge.
     */
    public function getUnreadCount(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->isAdmin() || $user->isStudent() || $user->role === 'faculty_staff') {
            return response()->json(['unread_count' => 0]);
        }

        $staffRole = $this->getStaffRole($user);
        if (!$staffRole) {
            return response()->json(['unread_count' => 0]);
        }

        $unreadCount = Message::whereHas('conversation', function ($q) use ($staffRole) {
            $q->where('staff_role', $staffRole);
        })
        ->where('sender_id', '!=', $user->id)
        ->whereNull('read_at')
        ->whereNull('deleted_at')
        ->count();

        return response()->json(['unread_count' => $unreadCount]);
    }

    /**
     * GET /api/chat/admin/stats
     * Admin-only: unanswered conversation count (no staff reply in 24h).
     */
    public function adminStats(): JsonResponse
    {
        $unanswered = Conversation::where('status', 'open')
            ->whereDoesntHave('messages', function ($q) {
                // Has at least one staff reply
                $q->whereHas('sender', function ($sq) {
                    $sq->whereIn('role', ['clinic_staff', 'dentist'])
                       ->orWhereHas('roleRelation', function ($rq) {
                           $rq->whereIn('slug', ['clinic_staff', 'nurse', 'dentist']);
                       });
                });
            })
            ->where('created_at', '<', now()->subHours(24))
            ->count();

        return response()->json(['unanswered_conversations' => $unanswered]);
    }
}
