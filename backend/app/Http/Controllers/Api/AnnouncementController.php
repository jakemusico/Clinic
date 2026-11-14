<?php

namespace App\Http\Controllers\Api;

use App\Support\Paging;
use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Notification;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use App\Support\CacheVersion;
use Illuminate\Support\Facades\Log;

class AnnouncementController extends Controller
{
    /**
     * The announcements a user may see, newest first. Shared with the dashboards.
     */
    public static function visibleQuery(\App\Models\User $user)
    {
        $query = Announcement::query()->orderBy('created_at', 'desc');

        // Students only see announcements targeted at them or everyone
        if ($user->role === 'student') {
            $query->whereIn('audience', ['All', 'Students']);
        } elseif (in_array($user->role, ['clinic_staff', 'dentist'])) {
            // Staff see their own + All
            $query->whereIn('audience', ['All', 'Staff']);
        }
        // admins see everything (no filter)

        return $query;
    }

    /**
     * The newest announcements a user may see (dashboards). Cached for 60 seconds PER AUDIENCE: the key holds
     * the audience the role is filtered to, never "all roles", and creating, editing or deleting an
     * announcement starts a new version.
     */
    public static function latestFor(\App\Models\User $user, int $limit)
    {
        $audience = match (true) {
            $user->role === 'student'                                  => 'students',
            in_array($user->role, ['clinic_staff', 'dentist'], true)   => 'staff',
            default                                                    => 'everything',
        };

        return Cache::remember(
            CacheVersion::key('announcements', 'latest', $audience, (string) $limit),
            60,
            fn () => self::visibleQuery($user)->limit($limit)->get()->toArray()
        );
    }

    /**
     * GET /api/announcements
     * Return announcements filtered by the authenticated user's role.
     * Admins and clinic staff see all announcements.
     */
    public function index(Request $request): JsonResponse
    {
        $user  = $request->user();
        $query = self::visibleQuery($user);

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', $search)
                  ->orWhere('message', 'like', $search);
            });
        }

        if (Paging::wantsAll($request)) {
            $announcements = $query->limit(Paging::ALL_LIMIT)->get();
            return response()->json([
                'announcements' => $announcements,
                'data'          => $announcements,
                'total'         => $announcements->count(),
            ]);
        }

        $perPage = Paging::perPage($request);
        $paginated = $query->paginate($perPage);

        return response()->json([
            'announcements'  => $paginated->items(),
            'data'           => $paginated->items(),
            'current_page'   => $paginated->currentPage(),
            'last_page'      => $paginated->lastPage(),
            'per_page'       => $paginated->perPage(),
            'total'          => $paginated->total(),
            'from'           => $paginated->firstItem(),
            'to'             => $paginated->lastItem(),
        ]);
    }

    /**
     * POST /api/announcements
     * Create an announcement. Notifications are sent outside the DB transaction
     * so a notify failure never rolls back the saved announcement.
     */
    public function store(Request $request): JsonResponse
    {
        $sender = $request->user();
        if (!in_array($sender->role, ['admin', 'clinic_staff'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'title'    => ['required', 'string', 'max:150'],
            'message'  => ['required', 'string', 'max:2000'],
            'audience' => ['required', 'string', 'in:All,Students,Staff'],
        ]);

        // Save announcement in a transaction
        $announcement = DB::transaction(function () use ($validated, $sender) {
            $ann = Announcement::create([
                'title'      => $validated['title'],
                'message'    => $validated['message'],
                'audience'   => $validated['audience'],
                'created_by' => $sender->id,
            ]);

            AuditLogger::log('announcement_created', Announcement::class, $ann->id);

            return $ann;
        });

        // Send notifications OUTSIDE the transaction so a failure doesn't lose the announcement
        $this->dispatchNotifications($announcement, $sender->id, $validated['title']);

        return response()->json([
            'message'      => 'Announcement created.',
            'announcement' => $announcement,
        ], 201);
    }

    /**
     * PUT /api/announcements/{announcement}
     */
    public function update(Request $request, Announcement $announcement): JsonResponse
    {
        $sender = $request->user();
        if (!in_array($sender->role, ['admin', 'clinic_staff'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'title'    => ['required', 'string', 'max:150'],
            'message'  => ['required', 'string', 'max:2000'],
            'audience' => ['required', 'string', 'in:All,Students,Staff'],
        ]);

        DB::transaction(function () use ($validated, $announcement, $sender) {
            $old = $announcement->toArray();
            $announcement->update($validated);
            AuditLogger::log('announcement_updated', Announcement::class, $announcement->id, $old, $announcement->getChanges());
        });

        // Notify updated title outside transaction
        $this->dispatchNotifications($announcement, $sender->id, 'Updated: ' . $announcement->title);

        return response()->json([
            'message'      => 'Announcement updated.',
            'announcement' => $announcement->fresh(),
        ]);
    }

    /**
     * DELETE /api/announcements/{announcement}
     */
    public function destroy(Request $request, Announcement $announcement): JsonResponse
    {
        $sender = $request->user();
        if (!in_array($sender->role, ['admin', 'clinic_staff'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        DB::transaction(function () use ($announcement, $sender) {
            // Remove linked notifications
            Notification::where('type', 'announcement')
                ->where('target_type', 'announcement')
                ->where('target_id', $announcement->id)
                ->delete();

            AuditLogger::log('announcement_deleted', Announcement::class, $announcement->id);
            $announcement->delete();
        });

        return response()->json(['message' => 'Announcement deleted.']);
    }

    // ── Private helpers ───────────────────────────────────────────────────

    /**
     * Resolve roles for an audience label.
     */
    private static function audienceRoles(string $audience): array
    {
        return match ($audience) {
            'Students' => ['student'],
            'Staff'    => ['clinic_staff', 'dentist'],
            default    => ['student', 'clinic_staff', 'dentist', 'admin'], // All
        };
    }

    /**
     * Insert one notification row per recipient. Swallows errors so the
     * announcement is never lost if this step fails.
     */
    private function dispatchNotifications(Announcement $announcement, int $creatorId, string $title): void
    {
        try {
            $roles = self::audienceRoles($announcement->audience);

            $users = User::roleIs($roles)
                ->where('is_active', true)
                ->where('id', '!=', $creatorId)
                ->get();

            if ($users->isEmpty()) {
                return;
            }

            $now  = now();
            $rows = $users->map(fn($u) => [
                'user_id'     => $u->id,
                'title'       => $title,
                'message'     => $announcement->message,
                'type'        => 'announcement',
                'target_type' => 'announcement',
                'target_id'   => $announcement->id,
                'is_read'     => false,
                'action_url'  => null,
                'created_at'  => $now,
                'updated_at'  => $now,
            ])->all();

            Notification::insert($rows);
        } catch (\Throwable $e) {
            Log::error('[AnnouncementController] Failed to dispatch notifications', [
                'announcement_id' => $announcement->id,
                'error'           => $e->getMessage(),
            ]);
        }
    }
}
