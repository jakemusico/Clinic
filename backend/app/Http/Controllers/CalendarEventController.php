<?php

namespace App\Http\Controllers;

use App\Models\CalendarEvent;
use App\Models\Notification;
use App\Models\User;
use App\Services\AuditLogger;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use App\Support\CacheVersion;

class CalendarEventController extends Controller
{
    /**
     * The calendar events a user may see, oldest first. Shared with the dashboards, which send
     * them along with the rest of their data so the calendar needs no request of its own.
     */
    public static function visibleEvents(User $user)
    {
        $roleSlug = $user->role_slug;
        $audiences = null;   // null = no filter (admin)
        if ($roleSlug === 'student') {
            $audiences = ['All', 'Students'];
        } elseif ($roleSlug === 'faculty_staff') {
            $audiences = ['All', 'Faculty/Staff'];
        } elseif (in_array($roleSlug, ['clinic_staff', 'nurse', 'dentist'])) {
            $audiences = ['All', 'Clinic Staff'];
        }

        // Cached for 60 seconds PER AUDIENCE (the key holds the audience list, so one role's events can never
        // be served to another). Creating, editing or deleting an event starts a new version.
        return Cache::remember(
            CacheVersion::key('calendar', 'events', $audiences ? implode('|', $audiences) : 'everything'),
            60,
            fn () => CalendarEvent::query()
                ->when($audiences, fn ($q) => $q->whereIn('audience', $audiences))
                ->orderBy('start_date', 'asc')
                ->get()
                ->toArray()
        );
    }

    public function index(Request $request)
    {
        return response()->json([
            'events' => self::visibleEvents($request->user()),
        ]);
    }

    public function store(Request $request)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title'       => 'required|string|max:255',
            'type'        => 'required|string|in:Clinic Closure,Health Activity,Holiday,Announcement',
            'start_date'  => 'required|date',
            'end_date'    => 'nullable|date|after_or_equal:start_date',
            'all_day'     => 'boolean',
            'start_time'  => ['nullable', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/'],
            'end_time'    => ['nullable', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/'],
            'description' => 'nullable|string|max:1000',
            'audience'    => 'required|string|in:All,Students,Faculty/Staff,Clinic Staff,Staff,Nurses,Dentists',
        ]);

        $validated['created_by'] = $request->user()->id;
        $validated['all_day'] = $request->boolean('all_day');

        $event = CalendarEvent::create($validated);

        AuditLogger::log('calendar_event_created', CalendarEvent::class, $event->id);

        $this->dispatchCalendarNotifications($event, 'created', $request->user()->id);

        return response()->json([
            'message' => 'Event created successfully',
            'event'   => $event
        ]);
    }

    public function update(Request $request, CalendarEvent $calendarEvent)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title'       => 'required|string|max:255',
            'type'        => 'required|string|in:Clinic Closure,Health Activity,Holiday,Announcement',
            'start_date'  => 'required|date',
            'end_date'    => 'nullable|date|after_or_equal:start_date',
            'all_day'     => 'boolean',
            'start_time'  => ['nullable', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/'],
            'end_time'    => ['nullable', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/'],
            'description' => 'nullable|string|max:1000',
            'audience'    => 'required|string|in:All,Students,Faculty/Staff,Clinic Staff,Staff,Nurses,Dentists',
        ]);

        $validated['all_day'] = $request->boolean('all_day');
        $oldVals = $calendarEvent->toArray();

        $calendarEvent->update($validated);

        AuditLogger::log('calendar_event_updated', CalendarEvent::class, $calendarEvent->id, $oldVals, $calendarEvent->getChanges());

        $this->dispatchCalendarNotifications($calendarEvent, 'updated', $request->user()->id);

        return response()->json([
            'message' => 'Event updated successfully',
            'event'   => $calendarEvent
        ]);
    }

    public function destroy(Request $request, CalendarEvent $calendarEvent)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $deletedEventCopy = clone $calendarEvent;

        $calendarEvent->delete();

        AuditLogger::log('calendar_event_deleted', CalendarEvent::class, $deletedEventCopy->id);

        $this->dispatchCalendarNotifications($deletedEventCopy, 'deleted', $request->user()->id);

        return response()->json([
            'message' => 'Event deleted successfully'
        ]);
    }

    private function dispatchCalendarNotifications(CalendarEvent $event, string $action, int $creatorId): void
    {
        try {
            $audienceMap = [
                'All'           => ['student', 'clinic_staff', 'nurse', 'dentist', 'faculty_staff', 'admin'],
                'Students'      => ['student'],
                'Faculty/Staff' => ['faculty_staff'],
                'Staff'         => ['faculty_staff', 'clinic_staff', 'nurse', 'dentist'],
                'Clinic Staff'  => ['clinic_staff', 'nurse', 'dentist'],
                'Nurses'        => ['clinic_staff', 'nurse'],
                'Dentists'      => ['dentist'],
            ];

            $roles = $audienceMap[$event->audience] ?? ['student', 'clinic_staff', 'nurse', 'dentist', 'faculty_staff', 'admin'];

            $users = User::roleIs($roles)
                ->where('is_active', true)
                ->where('id', '!=', $creatorId)
                ->get();

            if ($users->isEmpty()) {
                return;
            }

            $dateStr = $this->formatEventDateTime($event);

            if ($action === 'created') {
                $title = $event->title;
                $prefix = !empty($event->description) ? rtrim($event->description, '.') . ' - ' : '';
                $message = "{$prefix}Scheduled on {$dateStr}.";
                $type = 'info';
            } elseif ($action === 'updated') {
                $title = $event->title;
                $prefix = !empty($event->description) ? rtrim($event->description, '.') . ' - ' : '';
                $message = "Event schedule updated. {$prefix}Scheduled on {$dateStr}.";
                $type = 'warning';
            } elseif ($action === 'deleted') {
                $title = "Cancelled: {$event->title}";
                $message = "Event '{$event->title}' (scheduled {$dateStr}) has been cancelled.";
                $type = 'warning';
            } else {
                $title = $event->title;
                $message = "Scheduled on {$dateStr}.";
                $type = 'info';
            }

            $now = now();
            $notifications = [];
            foreach ($users as $user) {
                $notifications[] = [
                    'user_id'     => $user->id,
                    'title'       => $title,
                    'message'     => $message,
                    'type'        => $type,
                    'target_type' => 'calendar_event',
                    'target_id'   => $event->id,
                    'is_read'     => false,
                    'action_url'  => '/calendar',
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ];
            }

            Notification::insert($notifications);
        } catch (\Throwable $e) {
            Log::error('Failed to dispatch calendar event notification: ' . $e->getMessage(), [
                'event_id' => $event->id ?? null,
                'action'   => $action,
                'trace'    => $e->getTraceAsString(),
            ]);
        }
    }

    private function formatEventDateTime(CalendarEvent $event): string
    {
        $tz = 'Asia/Manila';
        $startDate = Carbon::parse($event->start_date)->timezone($tz)->format('M j, Y');

        if ($event->end_date && Carbon::parse($event->end_date)->format('Y-m-d') !== Carbon::parse($event->start_date)->format('Y-m-d')) {
            $endDate = Carbon::parse($event->end_date)->timezone($tz)->format('M j, Y');
            $dateStr = "{$startDate} to {$endDate}";
        } else {
            $dateStr = $startDate;
        }

        if (!$event->all_day && !empty($event->start_time)) {
            try {
                $startTime = Carbon::createFromTimeString($event->start_time)->format('g:i A');
                if (!empty($event->end_time)) {
                    $endTime = Carbon::createFromTimeString($event->end_time)->format('g:i A');
                    $dateStr .= ", {$startTime} – {$endTime}";
                } else {
                    $dateStr .= ", {$startTime}";
                }
            } catch (\Throwable $e) {
                $dateStr .= ", {$event->start_time}";
            }
        }

        return $dateStr;
    }
}
