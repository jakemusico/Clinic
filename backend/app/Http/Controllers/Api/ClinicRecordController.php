<?php

namespace App\Http\Controllers\Api;

use App\Support\Paging;
use App\Http\Controllers\Controller;
use App\Models\ClinicRecord;
use App\Models\DentalConsultation;
use App\Models\Patient;
use App\Models\User;
use App\Models\Appointment;
use App\Services\AuditLogger;
use App\Services\ConsultationServiceName;
use App\Support\AppointmentLink;
use App\Support\ComplaintCategoryResolver;
use App\Support\ProfileReadiness;
use App\Support\Roles;
use App\Support\VitalsRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ClinicRecordController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $desk = false;

        // Allow-list: nurse and admin (medical care), or a patient looking at their own records.
        if (! Roles::canAccessCare($user, Roles::MEDICAL) && ! Roles::isPatient($user)) {
            return response()->json(['message' => 'Forbidden. Only the nurse, an administrator or the patient can access medical clinic records.'], 403);
        }

        if (Roles::isAdmin($user)) {
            AuditLogger::log('admin_viewed_medical_records', ClinicRecord::class, null, null, [
                'search'     => $request->search ?? null,
                'patient_id' => $request->patient_id ?? null,
            ]);
        }

        $query = ClinicRecord::with(['patient.user', 'appointment.service', 'createdBy:' . Appointment::staffColumns()]);

        if (Roles::isPatient($user)) {
            $query->whereHas('patient', function ($q) use ($user) {
                $q->where('user_id', $user->id);
            });
        } else {
            // Desk mode (the consultations pages): date range on the effective consultation day
            // (visit_date, else the day it was created), service/staff filters and stats.
            $desk = $request->boolean('with_stats');
            $effDate = 'COALESCE(visit_date, DATE(created_at))';
            if ($request->filled('date_from')) {
                $query->whereRaw("{$effDate} >= ?", [$request->date_from]);
            }
            if ($request->filled('date_to')) {
                $query->whereRaw("{$effDate} <= ?", [$request->date_to]);
            }

            // Stat cards and filter options describe the date range only — search/service/staff
            // narrow the table, never the cards (same rule the page used client-side).
            $statsBase = $desk ? clone $query : null;

            if ($desk && $request->filled('service') && $request->service !== 'all') {
                $query->whereRaw("TRIM(COALESCE(service_name, '')) = ?", [trim($request->service)]);
            }
            if ($desk && $request->filled('staff') && $request->staff !== 'all') {
                $staffName = trim($request->staff);
                $query->where(function ($q) use ($staffName) {
                    $q->whereHas('createdBy', fn ($u) => $u->where('name', $staffName));
                    // Rows without a recorded staff member display as "Clinic Staff"
                    if ($staffName === 'Clinic Staff') {
                        $q->orWhereNull('created_by');
                    }
                });
            }

            if ($request->has('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search, $desk) {
                    $q->whereHas('patient.user', function ($qu) use ($search) {
                        $qu->where('name', 'like', "%{$search}%")
                          ->orWhere('email', 'like', "%{$search}%")
                          ->orWhere('student_id', 'like', "%{$search}%");
                    });
                    if ($desk) {
                        // Encrypted columns can't be matched with SQL LIKE; keep plaintext fields only.
                        $q->orWhere('service_name', 'like', "%{$search}%")
                          ->orWhere('complaint_category', 'like', "%{$search}%")
                          ->orWhereHas('createdBy', fn ($u) => $u->where('name', 'like', "%{$search}%"));
                    } else {
                        $q->orWhere('service_name', 'like', "%{$search}%")
                          ->orWhere('complaint_category', 'like', "%{$search}%");
                    }
                });
            }

            if ($request->has('patient_id')) {
                $query->where('patient_id', $request->patient_id);
            }
        }

        if ($desk ?? false) {
            $query->orderByRaw("{$effDate} DESC")->orderBy('id', 'desc');
        } else {
            $query->orderBy('visit_date', 'desc')->orderBy('created_at', 'desc');
        }

        // Desk stats + filter options (consultations pages): range-scoped cards, options from all rows.
        $deskStats = null;
        if ($desk && $statsBase) {
            $today = now()->toDateString();
            $cats = (clone $statsBase)
                ->selectRaw("COALESCE(NULLIF(TRIM(complaint_category), ''), 'Others') AS cat, COUNT(*) AS c")
                ->groupBy('cat')->get();
            // Same pick as the page: most frequent, ties by name ascending.
            $top = $cats->sort(fn ($a, $b) => ($b->c <=> $a->c) ?: strcoll($a->cat, $b->cat))->first();

            $deskStats = [
                'total'          => (clone $statsBase)->count(),
                'today'          => (clone $statsBase)->whereRaw("{$effDate} = ?", [$today])->count(),
                'walk_ins'       => (clone $statsBase)->whereNull('appointment_id')->count(),
                'top_complaint'  => $top ? "{$top->cat} ({$top->c})" : null,
            ];

            $allBase = ClinicRecord::query();
            $deskStats['filter_options'] = [
                'services' => (clone $allBase)->whereNotNull('service_name')
                    ->selectRaw('DISTINCT TRIM(service_name) AS s')->pluck('s')
                    ->map(fn ($s) => trim($s))->filter()->sort()->values()->all(),
                'staff' => collect((clone $allBase)->leftJoin('users as su', 'su.id', '=', 'clinic_records.created_by')
                        ->whereNotNull('clinic_records.created_by')->distinct()->pluck('su.name')->all())
                    ->when((clone $allBase)->whereNull('created_by')->exists(), fn ($c) => $c->push('Clinic Staff'))
                    ->sort()->values()->all(),
            ];
        }

        if ($request->boolean('all') || $request->get('paginate') === 'false') {
            $records = $query->limit(Paging::ALL_LIMIT)->get();
            return response()->json([
                'data'         => $records,
                'records'      => $records,
                'total'        => $records->count(),
                'current_page' => 1,
                'last_page'    => 1,
                'per_page'     => $records->count(),
                'stats'        => $deskStats,
            ]);
        }

        $perPage = Paging::perPage($request);
        $paginated = $query->paginate($perPage);

        return response()->json([
            'data'         => $paginated->items(),
            'records'      => $paginated->items(),
            'current_page' => $paginated->currentPage(),
            'last_page'    => $paginated->lastPage(),
            'per_page'     => $paginated->perPage(),
            'total'        => $paginated->total(),
            'from'         => $paginated->firstItem(),
            'to'           => $paginated->lastItem(),
            'stats'        => $deskStats,
        ]);
    }

    public function show(Request $request, ClinicRecord $clinicRecord): JsonResponse
    {
        $user = $request->user();

        if (! Roles::canAccessCare($user, Roles::MEDICAL) && ! Roles::isPatient($user)) {
            return response()->json(['message' => 'Forbidden. Only the nurse, an administrator or the patient can access medical clinic records.'], 403);
        }

        if (Roles::isPatient($user)) {
            $patient = Patient::where('user_id', $user->id)->first();
            if (! $patient || $clinicRecord->patient_id !== $patient->id) {
                return response()->json(['message' => 'Forbidden. You can only view your own records.'], 403);
            }
        }

        $clinicRecord->load(['patient.user', 'appointment.service', 'createdBy:' . Appointment::staffColumns()]);

        if (Roles::isAdmin($user)) {
            AuditLogger::log('admin_viewed_medical_record', ClinicRecord::class, $clinicRecord->id, null, [
                'patient_id'   => $clinicRecord->patient_id,
                'patient_name' => $clinicRecord->patient?->user?->name,
                'visit_date'   => $clinicRecord->visit_date,
            ]);
        } else {
            AuditLogger::log('record_accessed', ClinicRecord::class, $clinicRecord->id);
        }

        return response()->json(['record' => $clinicRecord]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! Roles::is($user, Roles::NURSE)) {
            return response()->json(['message' => 'Only nurse/clinic staff can create medical patient records.'], 403);
        }

        // Capture appointmentId but do NOT resolve service_name yet (fix #4: validate first)
        $appointmentId = $request->input('appointment_id');

        // Validate first (including appointment_id), THEN resolve service (fix #4)
        $validated = $request->validate(array_merge([
            'patient_id'       => ['required', 'integer', 'exists:patients,id'],
            'appointment_id'   => ['nullable', 'integer', Rule::exists('appointments', 'id')->where('appointment_type', 'medical'), Rule::unique('clinic_records', 'appointment_id')],
            'emergency_override' => ['nullable', 'boolean'],
            'emergency_reason'  => ['nullable', 'string', 'max:500'],
            'service_name'     => ConsultationServiceName::rules('medical', locked: (bool) $appointmentId),
            'visit_date'       => ['required', 'date', 'date_format:Y-m-d'],
            'chief_complaint'  => ['nullable', 'string', 'max:10000'],
            'diagnosis'        => ['nullable', 'string', 'max:255'],
            'assessment'       => ['nullable', 'string', 'max:10000'],
            'complaint_category' => ['nullable', 'string', 'max:100'],
            'complaint_category_id' => ['nullable', 'integer', 'exists:complaint_categories,id'],
            'symptoms'         => ['nullable', 'string', 'max:10000'],
            'treatment'        => ['nullable', 'string', 'max:10000'],
            'recommendation'   => ['nullable', 'string', 'max:10000'],
            'prescription'     => ['nullable', 'string', 'max:10000'],
            'notes'            => ['nullable', 'string', 'max:10000'],
            'remarks'          => ['nullable', 'string', 'max:10000'],
            'inventory_items'  => ['nullable', 'array'],
            'inventory_items.*.item_id'  => ['required_with:inventory_items', 'integer', 'distinct', 'exists:inventory_items,id'],
            'inventory_items.*.quantity' => ['required_with:inventory_items', 'integer', 'min:1'],
            'inventory_items.*.dosage_note' => ['nullable', 'string', 'max:255'],
        ], VitalsRules::rules()), [
            'service_name.required'   => 'Please select the clinic service for this consultation.',
            'service_name.exists'     => 'The selected service is not an available medical service.',
            'appointment_id.exists'   => 'That appointment is not a medical appointment.',
            'appointment_id.unique'   => 'That appointment already has a consultation record.',
            'inventory_items.*.item_id.distinct' => 'Each medicine or supply can only be listed once.',
        ]);

        // Now resolve service_name AFTER validation (fix #4)
        $validated['service_name'] = ConsultationServiceName::resolve($validated['service_name'], $validated['appointment_id'] ?? null);

        $validated = array_merge($validated, ComplaintCategoryResolver::resolve($validated));

        // Compute BMI server-side (fix #5)
        if (isset($validated['vitals'])) {
            $validated['vitals'] = VitalsRules::computeBMI($validated['vitals']);
        }

        $inventoryItems = $validated['inventory_items'] ?? [];

        // Walk-in readiness gate: a patient under 100% Clinic Record Readiness cannot be
        // seen without a confirmed appointment, unless staff override with a reason.
        $walkInPatient = Patient::find($validated['patient_id'] ?? null);
        $walkInBlocker = ProfileReadiness::walkInBlocker(
            $walkInPatient,
            isset($validated['appointment_id']) ? (int) $validated['appointment_id'] : null
        );
        $emergencyReason = trim((string) ($validated['emergency_reason'] ?? ''));
        $emergencyOverride = $request->boolean('emergency_override') && $emergencyReason !== '';
        if ($walkInBlocker && ! $emergencyOverride) {
            $patientName = $walkInPatient?->user?->name ?? 'This patient';
            return response()->json([
                'message'        => "{$patientName}'s profile is only {$walkInBlocker['percent']}% complete. Ask them to finish it in My Profile. Still needed: " . implode(', ', $walkInBlocker['missing']),
                'missing_fields' => $walkInBlocker['missing'],
                'readiness'      => $walkInBlocker['percent'],
            ], 403);
        }

        // ONE transaction: the record, the appointment, the patient history and the dispensed stock are
        // saved together. If stock is short or anything fails, none of it is kept and the API says so.
        $record = DB::transaction(function () use ($validated, $user, $inventoryItems) {
            // Locks the appointment, so a double click or retry cannot save a second record for it
            $appointment = AppointmentLink::claim(
                isset($validated['appointment_id']) ? (int) $validated['appointment_id'] : null,
                (int) $validated['patient_id'],
                ClinicRecord::class
            );

            $record = ClinicRecord::create([
                'patient_id'         => $validated['patient_id'],
                'appointment_id'     => $validated['appointment_id'] ?? null,
                'service_name'       => $validated['service_name'],
                'created_by'         => $user->id,
                'diagnosis'          => $validated['diagnosis'] ?? null,
                'assessment'         => $validated['assessment'] ?? null,
                'chief_complaint'    => $validated['chief_complaint'] ?? null,
                'complaint_category' => $validated['complaint_category'] ?? null,
                'complaint_category_id' => $validated['complaint_category_id'] ?? null,
                'symptoms'           => $validated['symptoms'] ?? null,
                'prescription'       => $validated['prescription'] ?? null,
                'remarks'            => $validated['remarks'] ?? null,
                'treatment'          => $validated['treatment'] ?? $validated['recommendation'] ?? null,
                'recommendation'     => $validated['recommendation'] ?? null,
                'notes'              => $validated['notes'] ?? null,
                'vitals'             => $this->cleanVitals($validated['vitals'] ?? null),
                'visit_date'         => $validated['visit_date'],
            ]);

            $appointment?->update(['status' => 'completed']);

            // Automatically update patient medical history
            $patient = Patient::find($record->patient_id);
            if ($patient) {
                $diagText = $record->diagnosis ?: ($record->assessment ?: ($record->chief_complaint ?: 'Consultation'));
                $entry = "[" . date('Y-m-d', strtotime($validated['visit_date'])) . "] " . $diagText;
                if ($record->treatment) {
                    $entry .= " - Treatment: " . $record->treatment;
                }
                $history = $patient->medical_history ? ($patient->medical_history . "\n" . $entry) : $entry;
                $patient->update(['medical_history' => $history]);
            }

            AuditLogger::log('record_created', ClinicRecord::class, $record->id, null, $record->toArray());

            // Dispense inventory items (throws InsufficientStockException -> everything above is rolled back)
            if (!empty($inventoryItems)) {
                InventoryController::dispenseForConsultation(
                    $inventoryItems,
                    'medical',
                    $record->id,
                    $patient?->user_id ?? 0,
                    $user->id,
                    $validated['visit_date']
                );
            }

            return $record;
        }, 3);

        if ($walkInBlocker && $emergencyOverride) {
            AuditLogger::log('walk_in_emergency_override', ClinicRecord::class, $record->id, null, [
                'patient_id' => $record->patient_id,
                'reason'     => $emergencyReason,
                'readiness'  => $walkInBlocker['percent'],
            ]);
        }

        return response()->json([
            'message' => 'Consultation record saved to patient medical record successfully.',
            'record'  => $record->load(['patient.user', 'appointment.service', 'createdBy:' . Appointment::staffColumns()]),
        ], 201);
    }

    public function update(Request $request, ClinicRecord $clinicRecord): JsonResponse
    {
        $user = $request->user();

        if (! Roles::is($user, Roles::NURSE)) {
            return response()->json(['message' => 'Only nurse/clinic staff can modify medical patient records.'], 403);
        }

        // Keep the saved service unless a different one is picked; a linked appointment's service always wins.
        $appointmentId = $request->exists('appointment_id') ? $request->input('appointment_id') : $clinicRecord->appointment_id;
        $given         = $request->input('service_name') ?? $clinicRecord->service_name;
        $serviceChanged = $given !== null && $given !== $clinicRecord->service_name;

        $validated = $request->validate(array_merge([
            'appointment_id'   => ['nullable', 'integer', Rule::exists('appointments', 'id')->where('appointment_type', 'medical'), Rule::unique('clinic_records', 'appointment_id')->ignore($clinicRecord->id)],
            'service_name'     => ConsultationServiceName::rules('medical', locked: (bool) $appointmentId || ! $serviceChanged, required: false),
            'visit_date'       => ['required', 'date', 'date_format:Y-m-d'],
            'chief_complaint'  => ['nullable', 'string', 'max:10000'],
            'diagnosis'        => ['nullable', 'string', 'max:255'],
            'assessment'       => ['nullable', 'string', 'max:10000'],
            'complaint_category' => ['nullable', 'string', 'max:100'],
            'complaint_category_id' => ['nullable', 'integer', 'exists:complaint_categories,id'],
            'symptoms'         => ['nullable', 'string', 'max:10000'],
            'treatment'        => ['nullable', 'string', 'max:10000'],
            'recommendation'   => ['nullable', 'string', 'max:10000'],
            'prescription'     => ['nullable', 'string', 'max:10000'],
            'notes'            => ['nullable', 'string', 'max:10000'],
            'remarks'          => ['nullable', 'string', 'max:10000'],
            'inventory_items'  => ['nullable', 'array'],
            'inventory_items.*.item_id'  => ['required_with:inventory_items', 'integer', 'distinct', 'exists:inventory_items,id'],
            'inventory_items.*.quantity' => ['required_with:inventory_items', 'integer', 'min:1'],
            'inventory_items.*.dosage_note' => ['nullable', 'string', 'max:255'],
        ], VitalsRules::rules()), [
            'service_name.exists'      => 'The selected service is not an available medical service.',
            'appointment_id.exists'    => 'That appointment is not a medical appointment.',
            'appointment_id.unique'    => 'That appointment already has a consultation record.',
            'inventory_items.*.item_id.distinct' => 'Each medicine or supply can only be listed once.',
        ]);

        // Resolve service_name AFTER validation (fix #4)
        $validated['service_name'] = ConsultationServiceName::resolve($validated['service_name'] ?? $clinicRecord->service_name, $validated['appointment_id'] ?? $appointmentId);

        $validated = array_merge($validated, ComplaintCategoryResolver::resolve($validated));

        // Compute BMI server-side (fix #5)
        if (array_key_exists('vitals', $validated)) {
            $validated['vitals'] = VitalsRules::computeBMI($this->cleanVitals($validated['vitals']));
        }

        $inventoryItems = $validated['inventory_items'] ?? [];

        DB::transaction(function () use ($validated, $user, $clinicRecord, $inventoryItems) {
            // Lock the record, and every item it dispensed before or will dispense now (sorted, once)
            ClinicRecord::whereKey($clinicRecord->id)->lockForUpdate()->first(['id']);
            InventoryController::lockConsultationItems('medical', $clinicRecord->id, $inventoryItems);

            // A different appointment may only be linked if it is the same patient's, still open and unused
            if (array_key_exists('appointment_id', $validated)
                && ! empty($validated['appointment_id'])
                && (int) $validated['appointment_id'] !== (int) $clinicRecord->appointment_id) {
                AppointmentLink::claim((int) $validated['appointment_id'], (int) $clinicRecord->patient_id, ClinicRecord::class, $clinicRecord->id);
            }

            $oldValues = $clinicRecord->toArray();
            $clinicRecord->update($validated);
            $newValues = $clinicRecord->getChanges();

            // Give back what this record dispensed, then check the stock and dispense again.
            // The stock check happens AFTER the reversal, so re-saving a record never fails
            // because of its own earlier dispense.
            InventoryController::reverseConsultationTransactions('medical', $clinicRecord->id);
            if (!empty($inventoryItems)) {
                $patient = Patient::find($clinicRecord->patient_id);
                InventoryController::dispenseForConsultation(
                    $inventoryItems,
                    'medical',
                    $clinicRecord->id,
                    $patient?->user_id ?? 0,
                    $user->id,
                    $validated['visit_date']
                );
            }

            AuditLogger::log('record_updated', ClinicRecord::class, $clinicRecord->id, $oldValues, $newValues);
        }, 3);

        return response()->json([
            'message' => 'Patient medical record updated successfully.',
            'record'  => $clinicRecord->load(['patient.user', 'appointment.service', 'createdBy:' . Appointment::staffColumns()]),
        ]);
    }

    /** Vital signs with every empty value removed; null when nothing was recorded. */
    private function cleanVitals(?array $vitals): ?array
    {
        if (! $vitals) {
            return null;
        }
        $clean = array_filter($vitals, fn ($v) => $v !== null && $v !== '');

        return $clean ?: null;
    }

    public function listPatients(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! Roles::isClinicStaff($user)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (Roles::isAdmin($user)) {
            AuditLogger::log('admin_viewed_patient_list', Patient::class);
        }

        // The nurse only gets the medical visit dates, the dentist only the dental ones, admin both.
        $showMedical = Roles::canAccessCare($user, Roles::MEDICAL);
        $showDental  = Roles::canAccessCare($user, Roles::DENTAL);

        $search = $request->query('search');

        // ?pick=1 is the consultation-form dropdown: bounded, searchable, patient profile eager-loaded.
        // Directory pages call this without pick and still get the full list.
        $pick = $request->boolean('pick');

        $users = User::with('patient')
            ->roleIs(['student', 'faculty_staff'])
            ->when($search, function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('first_name', 'like', "%{$search}%")
                      ->orWhere('last_name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%")
                      ->orWhere('student_id', 'like', "%{$search}%")
                      ->orWhere('grade_level', 'like', "%{$search}%")
                      ->orWhere('section', 'like', "%{$search}%")
                      ->orWhere('department', 'like', "%{$search}%");
                });
            })
            // All columns ProfileReadiness reads must be selected, or they count as empty.
            ->select(['id', 'name', 'first_name', 'last_name', 'email', 'student_id', 'role_id', 'contact_no', 'department', 'grade_level', 'section', 'avatar', 'date_of_birth', 'sex', 'address'])
            ->orderBy('name')
            ->when($pick, fn ($q) => $q->limit(50))
            ->get();

        // Patient profiles are created at registration (and by `patients:backfill`), never here.
        // A user without one cannot be consulted anyway (consultations need patients.id), so skip them.
        $users = $users->filter(fn ($u) => $u->patient !== null)->values();
        $patientIds = $users->map(fn ($u) => $u->patient->id)->all();

        // Date of the last visit, per kind of care (shown on the consultation form)
        $lastMedical = $showMedical && $patientIds
            ? ClinicRecord::whereIn('patient_id', $patientIds)->selectRaw('patient_id, MAX(visit_date) as last_visit')->groupBy('patient_id')->pluck('last_visit', 'patient_id')
            : collect();
        $lastDental = $showDental && $patientIds
            ? DentalConsultation::whereIn('patient_id', $patientIds)->selectRaw('patient_id, MAX(consultation_date) as last_visit')->groupBy('patient_id')->pluck('last_visit', 'patient_id')
            : collect();

        $patients = $users->map(function ($u) use ($lastMedical, $lastDental) {
            $patient = $u->patient;
            // patient is already eager-loaded: ProfileReadiness runs in memory, no extra queries.
            $readiness = ProfileReadiness::for($u);
            return [
                'id'                  => $patient->id,
                'user_id'             => $u->id,
                'name'                => $u->name,
                'email'               => $u->email,
                'student_id'          => $u->student_id,
                'role'                => $u->role,
                'contact_no'          => $u->contact_no,
                'department'          => $u->department,
                'grade_level'         => $u->grade_level,
                'section'             => $u->section,
                'avatar_url'          => $u->avatar_url,
                'allergies'           => $patient->allergies,
                'readiness'           => $readiness['percent'],
                'missing_fields'      => $readiness['missing'],
                'last_medical_visit'  => $lastMedical[$patient->id] ?? null,
                'last_dental_visit'   => $lastDental[$patient->id] ?? null,
            ];
        })->values();

        return response()->json(['patients' => $patients]);
    }
}
