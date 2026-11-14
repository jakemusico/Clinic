<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClinicStaffSchedule;
use App\Models\StaffUnavailability;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClinicStaffScheduleController extends Controller
{
    private const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // ── Schedules ────────────────────────────────────────────────────────

    /**
     * GET /api/clinic/schedules
     * Clinic staff & Dentist: own schedules only.
     * Admin: all staff schedules (optionally filter by ?staff_id=X).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            $staffId = $request->query('staff_id');
            $query = ClinicStaffSchedule::with('user:id,name,email,role_id')
                ->orderByRaw("FIELD(day_of_week, 'monday','tuesday','wednesday','thursday','friday','saturday','sunday')")
                ->orderBy('start_time');

            if ($staffId && $staffId !== 'all') {
                $query->where('user_id', $staffId);
            }

            return response()->json([
                'schedules'   => $query->get(),
                'staff_list'  => User::roleIs(['clinic_staff', 'nurse', 'dentist'])
                    ->where('is_active', true)
                    ->select('id', 'name', 'email', 'role_id')
                    ->orderBy('name')
                    ->get(),
            ]);
        }

        // Clinic staff / Dentist — own schedules only
        $schedules = ClinicStaffSchedule::where('user_id', $user->id)
            ->with('user:id,name,email,role_id')
            ->orderByRaw("FIELD(day_of_week, 'monday','tuesday','wednesday','thursday','friday','saturday','sunday')")
            ->orderBy('start_time')
            ->get();

        return response()->json([
            'schedules'  => $schedules,
            'staff_list' => [
                [
                    'id'    => $user->id,
                    'name'  => $user->name,
                    'email' => $user->email,
                    'role'  => $user->role,
                ],
            ],
        ]);
    }

    /**
     * POST /api/clinic/schedules
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'day_of_week'  => ['required', 'string', 'in:' . implode(',', self::DAYS)],
            'start_time'   => ['required', 'date_format:H:i'],
            'end_time'     => ['required', 'date_format:H:i', 'after:start_time'],
            'is_available' => ['boolean'],
            'notes'        => ['nullable', 'string', 'max:500'],
            'user_id'      => ['nullable', 'integer', 'exists:users,id'],
        ]);

        if ($user->role === 'admin') {
            if (empty($validated['user_id'])) {
                return response()->json(['message' => 'Please select a staff member for this schedule.'], 422);
            }
            $targetUser = User::roleIs(['clinic_staff', 'dentist'])->find($validated['user_id']);
            if (!$targetUser) {
                return response()->json(['message' => 'Selected user is not a valid clinic staff or dentist.'], 422);
            }
            $targetUserId = $targetUser->id;
        } else {
            // Nurse or Dentist can only add schedule for themselves
            $targetUserId = $user->id;
        }

        // Overlap check
        $overlap = $this->findOverlap($targetUserId, $validated['day_of_week'], $validated['start_time'], $validated['end_time']);
        if ($overlap) {
            return response()->json([
                'message' => 'Schedule overlaps with an existing entry for this staff member.',
                'conflict' => $overlap,
            ], 422);
        }

        $schedule = ClinicStaffSchedule::create([
            'user_id'      => $targetUserId,
            'day_of_week'  => $validated['day_of_week'],
            'start_time'   => $validated['start_time'],
            'end_time'     => $validated['end_time'],
            'is_available' => $validated['is_available'] ?? true,
            'notes'        => $validated['notes'] ?? null,
        ]);

        return response()->json([
            'message'  => 'Schedule created successfully.',
            'schedule' => $schedule->load('user:id,name,email,role'),
        ], 201);
    }

    /**
     * PUT /api/clinic/schedules/{id}
     */
    public function update(Request $request, ClinicStaffSchedule $clinicStaffSchedule): JsonResponse
    {
        $user = $request->user();

        // Ownership check for non-admin
        if ($user->role !== 'admin' && $clinicStaffSchedule->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'day_of_week'  => ['required', 'string', 'in:' . implode(',', self::DAYS)],
            'start_time'   => ['required', 'date_format:H:i'],
            'end_time'     => ['required', 'date_format:H:i', 'after:start_time'],
            'is_available' => ['boolean'],
            'notes'        => ['nullable', 'string', 'max:500'],
            'user_id'      => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $targetUserId = $clinicStaffSchedule->user_id;
        if ($user->role === 'admin' && !empty($validated['user_id'])) {
            $targetUser = User::roleIs(['clinic_staff', 'dentist'])->find($validated['user_id']);
            if (!$targetUser) {
                return response()->json(['message' => 'Selected user is not a valid clinic staff or dentist.'], 422);
            }
            $targetUserId = $targetUser->id;
        }

        // Overlap check (exclude self)
        $overlap = $this->findOverlap(
            $targetUserId,
            $validated['day_of_week'],
            $validated['start_time'],
            $validated['end_time'],
            $clinicStaffSchedule->id
        );

        if ($overlap) {
            return response()->json([
                'message'  => 'Schedule overlaps with an existing entry for this staff member.',
                'conflict' => $overlap,
            ], 422);
        }

        $clinicStaffSchedule->update([
            'user_id'      => $targetUserId,
            'day_of_week'  => $validated['day_of_week'],
            'start_time'   => $validated['start_time'],
            'end_time'     => $validated['end_time'],
            'is_available' => $validated['is_available'] ?? $clinicStaffSchedule->is_available,
            'notes'        => array_key_exists('notes', $validated) ? $validated['notes'] : $clinicStaffSchedule->notes,
        ]);

        return response()->json([
            'message'  => 'Schedule updated successfully.',
            'schedule' => $clinicStaffSchedule->fresh()->load('user:id,name,email,role'),
        ]);
    }

    /**
     * DELETE /api/clinic/schedules/{id}
     */
    public function destroy(Request $request, ClinicStaffSchedule $clinicStaffSchedule): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'admin' && $clinicStaffSchedule->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $clinicStaffSchedule->delete();

        return response()->json(['message' => 'Schedule deleted successfully.']);
    }

    // ── Slot Generation ──────────────────────────────────────────────────

    // ── Slot Generation & Availability ────────────────────────────────────

    /**
     * GET /api/appointments/available-dates?month=YYYY-MM&appointment_type=medical
     * Returns array of available dates in YYYY-MM-DD format for a given month and appointment type.
     */
    public function availableDates(Request $request): JsonResponse
    {
        $request->validate([
            'month'            => ['required', 'date_format:Y-m'],
            'appointment_type' => ['nullable', 'string', 'in:medical,dental'],
        ]);

        $type = $request->input('appointment_type', 'medical');
        $roles = ($type === 'dental') ? ['dentist'] : ['clinic_staff', 'nurse'];

        // Active staff members for this appointment type
        $staffMembers = User::roleIs($roles)->where('is_active', true)->get();

        if ($staffMembers->isEmpty()) {
            return response()->json([
                'month'            => $request->month,
                'appointment_type' => $type,
                'available_dates'  => [],
            ]);
        }

        $staffIds = $staffMembers->pluck('id')->toArray();

        // Parse month range
        $startOfMonth = Carbon::parse($request->month . '-01')->startOfMonth();
        $endOfMonth   = $startOfMonth->copy()->endOfMonth();
        $today        = Carbon::today();

        // Preload schedules and unavailabilities for the month
        $schedules = ClinicStaffSchedule::whereIn('user_id', $staffIds)
            ->where('is_available', true)
            ->get();

        $unavailabilities = StaffUnavailability::whereIn('user_id', $staffIds)
            ->whereBetween('unavailable_date', [$startOfMonth->format('Y-m-d'), $endOfMonth->format('Y-m-d')])
            ->get()
            ->groupBy(fn($u) => Carbon::parse($u->unavailable_date)->format('Y-m-d'));

        $availableDates = [];
        $curr = $startOfMonth->copy();

        while ($curr->lte($endOfMonth)) {
            // Cannot book dates in the past
            if ($curr->gte($today)) {
                $dateStr   = $curr->format('Y-m-d');
                $dayOfWeek = strtolower($curr->format('l'));

                // Blocked staff IDs on this specific date
                $blockedStaffOnDate = isset($unavailabilities[$dateStr])
                    ? $unavailabilities[$dateStr]->pluck('user_id')->toArray()
                    : [];

                // Check if any eligible staff member has working hours on this day and is not blocked
                $hasAvailableStaff = $schedules->contains(function ($sched) use ($dayOfWeek, $blockedStaffOnDate) {
                    return $sched->day_of_week === $dayOfWeek && !in_array($sched->user_id, $blockedStaffOnDate);
                });

                if ($hasAvailableStaff) {
                    $availableDates[] = $dateStr;
                }
            }
            $curr->addDay();
        }

        return response()->json([
            'month'            => $request->month,
            'appointment_type' => $type,
            'available_dates'  => $availableDates,
        ]);
    }

    /**
     * GET /api/appointments/slots?date=YYYY-MM-DD&appointment_type=medical&staff_id=X&duration=30
     * Returns available appointment slots for a given date, filtered by staff_id or appointment_type.
     */
    public function slots(Request $request): JsonResponse
    {
        $request->validate([
            'date'             => ['required', 'date', 'date_format:Y-m-d', 'after_or_equal:today'],
            'staff_id'         => ['nullable', 'integer', 'exists:users,id'],
            'appointment_type' => ['nullable', 'string', 'in:medical,dental'],
            'duration'         => ['nullable', 'integer', 'min:5', 'max:240'],
        ]);

        $date      = Carbon::parse($request->date);
        $slotMins  = (int) ($request->duration ?? 30);
        $dayOfWeek = strtolower($date->format('l'));
        $type      = $request->input('appointment_type', 'medical');

        // Resolve staff members
        if ($request->filled('staff_id')) {
            $staffQuery = User::where('id', $request->staff_id)->where('is_active', true);
        } else {
            $targetRoles = ($type === 'dental') ? ['dentist'] : ['clinic_staff', 'nurse'];
            $staffQuery = User::roleIs($targetRoles)->where('is_active', true);
        }

        $staffMembers = $staffQuery->get();

        if ($staffMembers->isEmpty()) {
            return response()->json([
                'date'             => $date->format('Y-m-d'),
                'appointment_type' => $type,
                'slots'            => [],
                'message'          => 'No active staff available for this service category.',
            ]);
        }

        $staffIds = $staffMembers->pluck('id')->toArray();

        // 1. Check unavailability
        $unavailStaffIds = StaffUnavailability::whereIn('user_id', $staffIds)
            ->whereDate('unavailable_date', $date)
            ->pluck('user_id')
            ->toArray();

        // Active, available staff on this date
        $availableStaff = $staffMembers->filter(fn($s) => !in_array($s->id, $unavailStaffIds));

        if ($availableStaff->isEmpty()) {
            return response()->json([
                'date'             => $date->format('Y-m-d'),
                'appointment_type' => $type,
                'slots'            => [],
                'message'          => 'All staff members are unavailable on this date.',
            ]);
        }

        $availableStaffIds = $availableStaff->pluck('id')->toArray();

        // 2. Fetch all schedules for available staff on this day
        $schedules = ClinicStaffSchedule::whereIn('user_id', $availableStaffIds)
            ->where('day_of_week', $dayOfWeek)
            ->where('is_available', true)
            ->get();

        if ($schedules->isEmpty()) {
            return response()->json([
                'date'             => $date->format('Y-m-d'),
                'appointment_type' => $type,
                'slots'            => [],
                'message'          => 'No clinic staff schedule defined for this day.',
            ]);
        }

        // 3. Fetch already-booked appointments on this date
        $bookedAppointments = \App\Models\Appointment::whereIn('staff_id', $availableStaffIds)
            ->whereDate('scheduled_at', $date)
            ->whereIn('status', ['pending', 'confirmed'])
            ->get();

        // Generate unique timeslots across all available staff schedules
        $timeMap = []; // 'HH:MM' => ['time' => ..., 'datetime' => ..., 'staff_options' => [ { staff_id, staff_name, is_booked } ]]

        foreach ($schedules as $sched) {
            $staff = $availableStaff->firstWhere('id', $sched->user_id);
            if (!$staff) continue;

            $current = Carbon::parse($date->format('Y-m-d') . ' ' . $sched->start_time);
            $end     = Carbon::parse($date->format('Y-m-d') . ' ' . $sched->end_time);

            // Pre-calculate staff's booked times
            $staffBookedTimes = $bookedAppointments
                ->where('staff_id', $staff->id)
                ->map(fn($a) => Carbon::parse($a->scheduled_at)->format('H:i'))
                ->toArray();

            while ($current->copy()->addMinutes($slotMins)->lte($end)) {
                $timeStr = $current->format('H:i');

                if (!isset($timeMap[$timeStr])) {
                    $timeMap[$timeStr] = [
                        'time'          => $timeStr,
                        'datetime'      => $current->format('Y-m-d H:i:s'),
                        'label'         => $current->format('g:i A'),
                        'staff_options' => [],
                    ];
                }

                $isBooked = in_array($timeStr, $staffBookedTimes);
                $timeMap[$timeStr]['staff_options'][] = [
                    'staff_id'   => $staff->id,
                    'staff_name' => $staff->name,
                    'is_booked'  => $isBooked,
                ];

                $current->addMinutes($slotMins);
            }
        }

        // Sort chronological by time key
        ksort($timeMap);

        // Build finalized slots with auto-assigned provider
        $finalSlots = [];
        foreach ($timeMap as $slotData) {
            $options = $slotData['staff_options'];
            $freeOption = collect($options)->firstWhere('is_booked', false);

            if ($freeOption) {
                // At least one provider is available for this slot
                $finalSlots[] = [
                    'time'        => $slotData['time'],
                    'datetime'    => $slotData['datetime'],
                    'label'       => $slotData['label'],
                    'is_booked'   => false,
                    'staff_id'    => $freeOption['staff_id'],
                    'staff_name'  => $freeOption['staff_name'],
                    'provider'    => $freeOption['staff_name'],
                ];
            } else {
                // All providers scheduled for this slot are booked
                $first = $options[0];
                $finalSlots[] = [
                    'time'        => $slotData['time'],
                    'datetime'    => $slotData['datetime'],
                    'label'       => $slotData['label'],
                    'is_booked'   => true,
                    'staff_id'    => $first['staff_id'],
                    'staff_name'  => $first['staff_name'],
                    'provider'    => $first['staff_name'],
                ];
            }
        }

        return response()->json([
            'date'             => $date->format('Y-m-d'),
            'appointment_type' => $type,
            'duration'         => $slotMins,
            'slots'            => $finalSlots,
        ]);
    }

    // ── Unavailability ───────────────────────────────────────────────────

    /**
     * GET /api/clinic/schedules/unavailability?staff_id=X
     */
    public function listUnavailability(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role === 'admin') {
            $staffId = $request->query('staff_id');
            $query = StaffUnavailability::with('user:id,name,email,role_id')
                ->orderBy('unavailable_date');

            if ($staffId && $staffId !== 'all') {
                $query->where('user_id', $staffId);
            }

            return response()->json(['unavailability' => $query->get()]);
        }

        $records = StaffUnavailability::where('user_id', $user->id)
            ->with('user:id,name,email,role_id')
            ->orderBy('unavailable_date')
            ->get();

        return response()->json(['unavailability' => $records]);
    }

    /**
     * POST /api/clinic/schedules/unavailability
     */
    public function storeUnavailability(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'unavailable_date' => ['required', 'date', 'date_format:Y-m-d', 'after_or_equal:today'],
            'reason'           => ['nullable', 'string', 'max:255'],
            'user_id'          => ['nullable', 'integer', 'exists:users,id'],
        ]);

        if ($user->role === 'admin') {
            if (empty($validated['user_id'])) {
                return response()->json(['message' => 'Please select a staff member to block this date for.'], 422);
            }
            $targetUser = User::roleIs(['clinic_staff', 'dentist'])->find($validated['user_id']);
            if (!$targetUser) {
                return response()->json(['message' => 'Selected user is not a valid clinic staff or dentist.'], 422);
            }
            $targetUserId = $targetUser->id;
        } else {
            $targetUserId = $user->id;
        }

        $record = StaffUnavailability::updateOrCreate(
            ['user_id' => $targetUserId, 'unavailable_date' => $validated['unavailable_date']],
            ['reason' => $validated['reason'] ?? null]
        );

        return response()->json([
            'message'       => 'Unavailable date marked.',
            'unavailability' => $record->load('user:id,name,email,role'),
        ], 201);
    }

    /**
     * DELETE /api/clinic/schedules/unavailability/{id}
     */
    public function destroyUnavailability(Request $request, StaffUnavailability $staffUnavailability): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'admin' && $staffUnavailability->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $staffUnavailability->delete();

        return response()->json(['message' => 'Unavailable date removed.']);
    }

    // ── Private Helpers ──────────────────────────────────────────────────

    private function findOverlap(int $userId, string $day, string $start, string $end, ?int $excludeId = null): ?ClinicStaffSchedule
    {
        return ClinicStaffSchedule::where('user_id', $userId)
            ->where('day_of_week', $day)
            ->when($excludeId, fn($q) => $q->where('id', '!=', $excludeId))
            ->where(function ($q) use ($start, $end) {
                // New slot overlaps if: new_start < existing_end AND new_end > existing_start
                $q->where('start_time', '<', $end)
                  ->where('end_time', '>', $start);
            })
            ->first();
    }
}
