<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\ClinicService;
use App\Models\ClinicStaffSchedule;
use App\Models\StaffUnavailability;
use App\Models\Patient;
use App\Models\User;
use App\Models\Notification;
use Carbon\Carbon;
use App\Services\AuditLogger;
use App\Support\Roles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;


class AppointmentController extends Controller
{
    /**
     * GET /api/appointments/unread-count
     * Returns dynamic unread appointment counts for management roles.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $user = $request->user();

        // Only the kinds of care the user manages are counted (nurse: medical, dentist: dental, admin: both).
        $types = Roles::careTypes($user);

        $medicalCount = in_array(Roles::MEDICAL, $types, true)
            ? Appointment::where('appointment_type', 'medical')->where('is_read', false)->count()
            : 0;
        $dentalCount = in_array(Roles::DENTAL, $types, true)
            ? Appointment::where('appointment_type', 'dental')->where('is_read', false)->count()
            : 0;

        return response()->json([
            'unread_count'         => $medicalCount + $dentalCount,
            'medical_unread_count' => $medicalCount,
            'dental_unread_count'  => $dentalCount,
        ]);
    }

    /**
     * POST /api/appointments/mark-read
     * Mark all appointments of given type or role as read.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();

        $types = Roles::careTypes($user);
        if (! $types) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        // Never more than the user's own kinds of care; admin may narrow it to one with appointment_type.
        $requested = $request->input('appointment_type');
        if (is_string($requested) && in_array($requested, $types, true)) {
            $types = [$requested];
        }

        $query = Appointment::where('is_read', false)->whereIn('appointment_type', $types);

        $affected = $query->update(['is_read' => true]);

        return response()->json([
            'message'  => "{$affected} appointment(s) marked as read.",
            'affected' => $affected,
        ]);
    }

    /**
     * PATCH /api/appointments/{appointment}/read
     * Mark a single appointment as read.
     */
    public function markRead(Request $request, Appointment $appointment): JsonResponse
    {
        $user = $request->user();

        if (! Roles::canAccessCare($user, $appointment->appointment_type)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $appointment->update(['is_read' => true]);

        return response()->json([
            'message'     => 'Appointment marked as read.',
            'appointment' => $appointment,
        ]);
    }

    /**
     * GET /api/appointments
     * Lists appointments.
     * Student/Faculty: own appointments only.
     * Clinic Staff/Dentist: all appointments.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        // Allow-list: a patient (own appointments only) or clinic staff (their own kind of care). Nobody else.
        $types = Roles::careTypes($user);
        if (! Roles::isPatient($user) && ! $types) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        // Explicit columns for the patient and the staff member (no full user rows). The nurse is only
        // given the medical consultation of an appointment, the dentist only the dental one.
        $relations = ['clinicRecord', 'dentalConsultation'];
        if (! Roles::isPatient($user)) {
            $relations = array_values(array_filter([
                in_array(Roles::MEDICAL, $types, true) ? 'clinicRecord' : null,
                in_array(Roles::DENTAL, $types, true) ? 'dentalConsultation' : null,
            ]));
        }
        $query = Appointment::with(Appointment::safeRelations($relations));

        if (Roles::isPatient($user)) {
            $query->whereHas('patient', function ($q) use ($user) {
                $q->where('user_id', $user->id);
            });
        } else {
            // Clinic Staff / Dentist / Admin filters
            if ($request->filled('status') && $request->status !== 'all') {
                $query->where('status', $request->status);
            }
            if ($request->filled('date')) {
                $query->whereDate('scheduled_at', $request->date);
            }
            if ($request->filled('staff_id') && $request->staff_id !== 'all') {
                $query->where('staff_id', $request->staff_id);
            }
            if ($request->filled('patient_id') && $request->patient_id !== 'all') {
                $query->where('patient_id', $request->patient_id);
            }
            if ($request->filled('appointment_type') && $request->appointment_type !== 'all') {
                $query->where('appointment_type', $request->appointment_type);
            }
            // The nurse only ever sees medical appointments and the dentist only dental ones,
            // whatever the request asks for. Admin sees both.
            $query->whereIn('appointment_type', $types);
            // ?care_type=medical|dental -> only appointments whose service is of that kind of care
            if (in_array($request->query('care_type'), ClinicService::CARE_TYPES, true)) {
                $query->whereHas('service', fn ($q) => $q->where('care_type', $request->query('care_type')));
            }
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('patient.user', function ($qu) use ($search) {
                    $qu->where('name', 'like', "%{$search}%")
                       ->orWhere('student_id', 'like', "%{$search}%")
                       ->orWhere('email', 'like', "%{$search}%");
                })->orWhereHas('service', function ($qs) use ($search) {
                    $qs->where('name', 'like', "%{$search}%");
                });
            });
        }

        $query->orderBy('scheduled_at', 'asc');

        if ($request->boolean('all') || $request->get('paginate') === 'false') {
            $appointments = $query->get();
            return response()->json([
                'data'         => $appointments,
                'appointments' => $appointments,
                'total'        => $appointments->count(),
                'current_page' => 1,
                'last_page'    => 1,
                'per_page'     => $appointments->count(),
            ]);
        }

        $perPage = (int) $request->get('per_page', 10);
        $paginated = $query->paginate($perPage);

        return response()->json([
            'data'         => $paginated->items(),
            'appointments' => $paginated->items(),
            'current_page' => $paginated->currentPage(),
            'last_page'    => $paginated->lastPage(),
            'per_page'     => $paginated->perPage(),
            'total'        => $paginated->total(),
            'from'         => $paginated->firstItem(),
            'to'           => $paginated->lastItem(),
        ]);
    }

    /**
     * POST /api/appointments
     * Book an appointment (Student/Faculty).
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        // Only students and faculty/staff can book appointments as patients
        if (! Roles::isPatient($user)) {
            return response()->json(['message' => 'Only students and faculty/staff members can book appointments.'], 403);
        }

        // Retrieve or create patient profile
        $patient = Patient::firstOrCreate(['user_id' => $user->id]);

        $validated = $request->validate([
            'service_id'       => ['required', 'integer', 'exists:clinic_services,id'],
            'staff_id'         => ['required', 'integer', 'exists:users,id'],
            'scheduled_at'     => ['required', 'date', 'after:now'],
            'appointment_type' => ['required', 'string', 'in:medical,dental'],
            'notes'            => ['nullable', 'string', 'max:500'],
        ]);

        $serviceId   = $validated['service_id'];
        $staffId     = $validated['staff_id'];
        $scheduledAt = Carbon::parse($validated['scheduled_at']);
        $dateStr     = $scheduledAt->format('Y-m-d');
        $timeStr     = $scheduledAt->format('H:i');

        // Check if the service is active
        $service = ClinicService::findOrFail($serviceId);
        if (! $service->is_active) {
            return response()->json(['message' => 'This service is currently unavailable.'], 422);
        }

        // The service must belong to the kind of care being booked (medical -> nurse, dental -> dentist)
        if ($service->care_type !== $validated['appointment_type']) {
            return response()->json([
                'message' => "This is not a {$validated['appointment_type']} service. Please choose a {$validated['appointment_type']} service.",
            ], 422);
        }

        // Check staff role
        $staff = User::findOrFail($staffId);
        if (!in_array($staff->role, ['clinic_staff', 'dentist'])) {
            return response()->json(['message' => 'Selected staff member is not part of the clinic crew.'], 422);
        }

        // Check the slot and create the appointment in ONE transaction. The staff member's row is locked
        // first, so two people booking the same staff member at the same moment are handled one after
        // the other: the second one finds the first booking and is refused.
        $result = DB::transaction(function () use ($staffId, $dateStr, $timeStr, $service, $patient, $serviceId, $scheduledAt, $validated) {
            User::whereKey($staffId)->lockForUpdate()->first();

            $err = $this->validateSlot($staffId, $dateStr, $timeStr, null, $this->serviceMinutes($service));
            if ($err) {
                return $err;
            }

            return Appointment::create([
                'patient_id'       => $patient->id,
                'service_id'       => $serviceId,
                'staff_id'         => $staffId,
                'scheduled_at'     => $scheduledAt,
                'appointment_type' => $validated['appointment_type'],
                'status'           => 'pending',
                'is_read'          => false,
                'notes'            => $validated['notes'] ?? null,
            ]);
        }, 3);

        if (is_string($result)) {
            return response()->json(['message' => $result], 422);
        }

        $appointment = $result;

        // Notify attending staff
        $isDental = $service->care_type === ClinicService::CARE_DENTAL;
        $staffUrl = $isDental
            ? "/dental/appointments?status=pending&highlight={$appointment->id}"
            : "/clinic/appointments?status=pending&highlight={$appointment->id}";

        Notification::create([
            'user_id'    => $staffId,
            'title'      => 'New Appointment Booked',
            'message'    => "Patient {$user->name} has booked {$service->name} for " . $scheduledAt->format('M d, Y g:i A') . ".",
            'type'       => 'info',
            'action_url' => $staffUrl,
        ]);

        AuditLogger::log('appointment_created', Appointment::class, $appointment->id, null, $appointment->toArray());

        return response()->json([
            'message'     => 'Appointment booked successfully.',
            'appointment' => $appointment->load(['service', Appointment::staffRelation()]),
        ], 201);
    }

    /**
     * PUT /api/appointments/{id}/reschedule
     * Reschedule appointment.
     */
    public function reschedule(Request $request, Appointment $appointment): JsonResponse
    {
        $user = $request->user();

        // Authorization (allow-list): a patient for their own appointment, or the staff member whose
        // kind of care it is (nurse: medical, dentist: dental, admin: both). Everybody else is refused.
        if (Roles::isPatient($user)) {
            if ($appointment->patient->user_id !== $user->id) {
                return response()->json(['message' => 'Forbidden.'], 403);
            }
            if ($appointment->status === 'completed' || $appointment->status === 'cancelled') {
                return response()->json(['message' => 'Cannot reschedule completed or cancelled appointments.'], 422);
            }
        } elseif (! Roles::canAccessCare($user, $appointment->appointment_type)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'scheduled_at' => ['required', 'date', 'after:now'],
        ]);

        $newSchedule = Carbon::parse($validated['scheduled_at']);
        $dateStr     = $newSchedule->format('Y-m-d');
        $timeStr     = $newSchedule->format('H:i');

        $oldValues = $appointment->toArray();

        // Same rule as booking: lock the staff member, check the new time, then move the appointment
        $err = DB::transaction(function () use ($appointment, $dateStr, $timeStr, $newSchedule) {
            User::whereKey($appointment->staff_id)->lockForUpdate()->first();

            $err = $this->validateSlot($appointment->staff_id, $dateStr, $timeStr, $appointment->id, $this->serviceMinutes($appointment->service));
            if ($err) {
                return $err;
            }

            $appointment->update([
                'scheduled_at' => $newSchedule,
                'status'       => 'pending', // reset to pending on reschedule
            ]);

            return null;
        }, 3);

        if ($err) {
            return response()->json(['message' => $err], 422);
        }

        $newValues = $appointment->getChanges();

        AuditLogger::log('appointment_rescheduled', Appointment::class, $appointment->id, $oldValues, $newValues);

        // Notify the counterpart
        $targetUserId = Roles::isClinicStaff($user)
            ? $appointment->patient->user_id
            : $appointment->staff_id;

        $isDental = in_array(strtolower($appointment->service->category ?? ''), ['dental']);
        $targetActionUrl = Roles::isClinicStaff($user)
            ? "/appointments?status=pending&highlight={$appointment->id}"
            : ($isDental
                ? "/dental/appointments?status=pending&highlight={$appointment->id}"
                : "/clinic/appointments?status=pending&highlight={$appointment->id}");

        Notification::create([
            'user_id'    => $targetUserId,
            'title'      => 'Appointment Rescheduled',
            'message'    => "Appointment for {$appointment->service->name} was rescheduled by {$user->name} to " . $newSchedule->format('M d, Y g:i A') . ".",
            'type'       => 'warning',
            'action_url' => $targetActionUrl,
        ]);

        return response()->json([
            'message'     => 'Appointment rescheduled successfully.',
            'appointment' => $appointment->load(['service', Appointment::staffRelation()]),
        ]);
    }

    /**
     * PATCH /api/appointments/{id}/status
     * Confirm, Complete, or Cancel an appointment.
     */
    public function updateStatus(Request $request, Appointment $appointment): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'status'              => ['required', 'string', 'in:confirmed,completed,cancelled'],
            'cancellation_reason' => ['nullable', 'string', 'max:255'],
        ]);

        $newStatus = $validated['status'];

        // Authorization rules (allow-list):
        if (Roles::isPatient($user)) {
            // Patient can only cancel their own appointments
            if ($appointment->patient->user_id !== $user->id) {
                return response()->json(['message' => 'Forbidden.'], 403);
            }
            if ($newStatus !== 'cancelled') {
                return response()->json(['message' => 'Patients can only cancel their own appointments.'], 403);
            }
        } elseif (! Roles::canAccessCare($user, $appointment->appointment_type)) {
            // Staff confirm, complete or cancel only appointments of their own kind of care
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $oldValues = $appointment->toArray();
        $appointment->update([
            'status'              => $newStatus,
            'cancellation_reason' => $newStatus === 'cancelled' ? ($validated['cancellation_reason'] ?? 'Cancelled by user') : null,
        ]);
        $newValues = $appointment->getChanges();

        AuditLogger::log('appointment_status_changed', Appointment::class, $appointment->id, $oldValues, $newValues);

        // Notify patient or staff of status change
        $targetUserId = Roles::isClinicStaff($user)
            ? $appointment->patient->user_id
            : $appointment->staff_id;

        $badgeType = $newStatus === 'cancelled' ? 'error' : ($newStatus === 'confirmed' ? 'success' : 'info');

        $isDental = in_array(strtolower($appointment->service->category ?? ''), ['dental']);
        $statusActionUrl = Roles::isClinicStaff($user)
            ? "/appointments?status={$newStatus}&highlight={$appointment->id}"
            : ($isDental
                ? "/dental/appointments?status={$newStatus}&highlight={$appointment->id}"
                : "/clinic/appointments?status={$newStatus}&highlight={$appointment->id}");

        Notification::create([
            'user_id'    => $targetUserId,
            'title'      => 'Appointment ' . ucfirst($newStatus),
            'message'    => "The appointment for {$appointment->service->name} on " . Carbon::parse($appointment->scheduled_at)->format('M d, Y g:i A') . " has been marked as {$newStatus} by {$user->name}." . ($newStatus === 'cancelled' ? " Reason: " . $appointment->cancellation_reason : ""),
            'type'       => $badgeType,
            'action_url' => $statusActionUrl,
        ]);

        return response()->json([
            'message'     => "Appointment marked as {$newStatus}.",
            'appointment' => $appointment->load(['service', Appointment::staffRelation()]),
        ]);

    }

    /**
     * GET /api/clinic/staff-list
     * Helper to list all available clinic staff for patients to select.
     */
    public function listStaff(Request $request): JsonResponse
    {
        $staff = User::where(function($q) {
                $q->whereIn('role', ['clinic_staff', 'nurse', 'dentist'])
                  ->orWhereHas('roleRelation', fn($rq) => $rq->whereIn('slug', ['clinic_staff', 'nurse', 'dentist']));
            })
            ->where('is_active', true)
            ->select(Appointment::STAFF_COLUMNS)
            ->get();

        return response()->json(['staff' => $staff]);
    }

    // ── Helper Slot Validator ──────────────────────────────────────────

    /** How long an appointment for this service lasts (minutes); 30 when the service has no duration. */
    private function serviceMinutes(?ClinicService $service): int
    {
        $minutes = (int) ($service?->duration_minutes ?? 0);

        return $minutes > 0 ? $minutes : 30;
    }

    /**
     * Returns an error message, or null when the staff member can take the appointment.
     * Call inside the transaction that holds the staff member's row lock.
     */
    private function validateSlot(int $staffId, string $dateStr, string $timeStr, ?int $excludeAppointmentId = null, int $durationMinutes = 30): ?string
    {
        $date      = Carbon::parse($dateStr);
        $dayOfWeek = strtolower($date->format('l'));

        // 1. Unavailability Check
        $isUnavailable = StaffUnavailability::where('user_id', $staffId)
            ->whereDate('unavailable_date', $date)
            ->exists();
        if ($isUnavailable) {
            return 'Staff member is unavailable on this date.';
        }

        // 2. Schedule Window Check
        // Check if the staff has an active schedule covering the specific day of week and slot
        $hasSchedule = ClinicStaffSchedule::where('user_id', $staffId)
            ->where('day_of_week', $dayOfWeek)
            ->where('is_available', true)
            ->where('start_time', '<=', $timeStr)
            ->where('end_time', '>', $timeStr)
            ->exists();
        if (! $hasSchedule) {
            return 'Selected time is outside the staff member\'s working hours.';
        }

        // 3. Double Booking Check: the new appointment runs from $start to $end (service duration) and must
        //    not overlap ANY active appointment of this staff member, whatever its own duration is.
        $start = Carbon::parse("{$dateStr} {$timeStr}");
        $end   = $start->copy()->addMinutes($durationMinutes);

        $sameDay = Appointment::with('service:id,duration_minutes')
            ->where('staff_id', $staffId)
            ->whereBetween('scheduled_at', [$start->copy()->startOfDay(), $start->copy()->endOfDay()])
            ->whereIn('status', ['pending', 'confirmed'])
            ->when($excludeAppointmentId, fn($q) => $q->where('id', '!=', $excludeAppointmentId))
            ->get();

        foreach ($sameDay as $other) {
            $otherStart = Carbon::parse($other->scheduled_at);
            $otherEnd   = $otherStart->copy()->addMinutes($this->serviceMinutes($other->service));

            if ($otherStart->lt($end) && $otherEnd->gt($start)) {
                return $otherStart->equalTo($start)
                    ? 'This slot is already booked.'
                    : 'This time overlaps another booking for this staff member (' . $otherStart->format('g:i A') . ' to ' . $otherEnd->format('g:i A') . ').';
            }
        }

        return null;
    }
}
