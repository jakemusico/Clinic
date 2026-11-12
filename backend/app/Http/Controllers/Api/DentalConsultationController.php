<?php

namespace App\Http\Controllers\Api;

use App\Support\Paging;
use App\Http\Controllers\Controller;
use App\Models\DentalConsultation;
use App\Models\DentalChart;
use App\Models\DentalChartTooth;
use App\Models\Patient;
use App\Models\Appointment;
use App\Services\AuditLogger;
use App\Services\ConsultationServiceName;
use App\Support\AppointmentLink;
use App\Support\CacheVersion;
use App\Support\ComplaintCategoryResolver;
use App\Support\ProfileReadiness;
use App\Support\Roles;
use App\Support\VitalsRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DentalConsultationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Allow-list: dentist and admin (dental care), or a patient looking at their own records.
        if (! Roles::canAccessCare($user, Roles::DENTAL) && ! Roles::isPatient($user)) {
            return response()->json(['message' => 'Forbidden. Only the dentist, an administrator or the patient can access dental consultations.'], 403);
        }

        $query = DentalConsultation::with(['patient.user', 'appointment.service', 'dentist:' . Appointment::staffColumns()]);

        $desk = false;
        $statsBase = null;
        $effDate = 'COALESCE(consultation_date, DATE(created_at))';

        if (Roles::isPatient($user)) {
            $query->whereHas('patient', function ($q) use ($user) {
                $q->where('user_id', $user->id);
            })->where('status', 'completed');
        } else {
            // Desk mode (the consultations page): date range on the effective consultation day
            // (consultation_date, else the day it was created), service/dentist filters and stats.
            $desk = $request->boolean('with_stats');

            if ($request->filled('date_from')) {
                $query->whereRaw("{$effDate} >= ?", [$request->date_from]);
            }
            if ($request->filled('date_to')) {
                $query->whereRaw("{$effDate} <= ?", [$request->date_to]);
            }

            // Stat cards describe the date range only — search/service/dentist narrow the table.
            $statsBase = $desk ? clone $query : null;

            if ($desk && $request->filled('service') && $request->service !== 'all') {
                $query->whereRaw("TRIM(COALESCE(service_name, '')) = ?", [trim($request->service)]);
            }
            if ($desk && $request->filled('staff') && $request->staff !== 'all') {
                $query->whereHas('dentist', fn ($u) => $u->where('name', trim($request->staff)));
            }

            if ($request->has('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search, $desk) {
                    $q->whereHas('patient.user', function ($qu) use ($search, $desk) {
                        $qu->where('name', 'like', "%{$search}%")
                          ->orWhere('student_id', 'like', "%{$search}%");
                        if (! $desk) {
                            $qu->orWhere('email', 'like', "%{$search}%");
                        }
                    });
                    if ($desk) {
                        // Encrypted columns can't be matched with SQL LIKE; keep plaintext fields only.
                        $q->orWhere('service_name', 'like', "%{$search}%")
                          ->orWhereHas('dentist', fn ($u) => $u->where('name', 'like', "%{$search}%"));
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

        // The page keeps the API order (consultation_date, created_at); id breaks exact ties
        // so server-side pagination is stable.
        $query->orderBy('consultation_date', 'desc')->orderBy('created_at', 'desc')->orderBy('id', 'desc');

        // Desk stats + filter options (consultations page): range-scoped cards, options from all rows.
        $deskStats = null;
        if ($desk && $statsBase) {
            $today = now()->toDateString();
            $cats = (clone $statsBase)
                ->selectRaw("COALESCE(NULLIF(TRIM(complaint_category), ''), 'Others') AS cat, COUNT(*) AS c")
                ->groupBy('cat')->get();
            $top = $cats->sort(fn ($a, $b) => ($b->c <=> $a->c) ?: strcoll($a->cat, $b->cat))->first();

            $deskStats = [
                'total'          => (clone $statsBase)->count(),
                'today'          => (clone $statsBase)->whereRaw("{$effDate} = ?", [$today])->count(),
                'walk_ins'       => (clone $statsBase)->whereNull('appointment_id')->count(),
                'top_complaint'  => $top ? "{$top->cat} ({$top->c})" : null,
            ];

            $allBase = DentalConsultation::query();
            $deskStats['filter_options'] = [
                'services' => (clone $allBase)->whereNotNull('service_name')
                    ->selectRaw('DISTINCT TRIM(service_name) AS s')->pluck('s')
                    ->map(fn ($s) => trim($s))->filter()->sort()->values()->all(),
                'staff' => (clone $allBase)->leftJoin('users as su', 'su.id', '=', 'dental_consultations.created_by')
                    ->whereNotNull('dental_consultations.created_by')->distinct()->pluck('su.name')
                    ->sort()->values()->all(),
            ];
        }

        if ($request->boolean('all') || $request->get('paginate') === 'false') {
            $consultations = $query->limit(Paging::ALL_LIMIT)->get();
            if (Roles::isPatient($user)) {
                $consultations->makeHidden(['staff_notes']);
            }
            return response()->json([
                'data'          => $consultations,
                'consultations' => $consultations,
                'total'         => $consultations->count(),
                'current_page'  => 1,
                'last_page'     => 1,
                'per_page'      => $consultations->count(),
                'stats'         => $deskStats,
            ]);
        }

        $perPage = Paging::perPage($request);
        $paginated = $query->paginate($perPage);

        if (Roles::isPatient($user)) {
            $paginated->getCollection()->makeHidden(['staff_notes']);
        }

        return response()->json([
            'data'          => $paginated->items(),
            'consultations' => $paginated->items(),
            'current_page'  => $paginated->currentPage(),
            'last_page'     => $paginated->lastPage(),
            'per_page'      => $paginated->perPage(),
            'total'         => $paginated->total(),
            'from'          => $paginated->firstItem(),
            'to'            => $paginated->lastItem(),
            'stats'         => $deskStats,
        ]);
    }

    public function show(Request $request, DentalConsultation $dentalConsultation): JsonResponse
    {
        $user = $request->user();

        // Allow-list: dentist and admin (dental care), or a patient looking at their own records.
        if (! Roles::canAccessCare($user, Roles::DENTAL) && ! Roles::isPatient($user)) {
            return response()->json(['message' => 'Forbidden. Only the dentist, an administrator or the patient can access dental consultations.'], 403);
        }

        if (Roles::isPatient($user)) {
            $patient = Patient::where('user_id', $user->id)->first();
            if (! $patient || $dentalConsultation->patient_id !== $patient->id) {
                return response()->json(['message' => 'Forbidden. You can only view your own dental records.'], 403);
            }
            $dentalConsultation->makeHidden(['staff_notes']);
        }

        $dentalConsultation->load(['patient.user', 'appointment.service', 'dentist:' . Appointment::staffColumns()]);

        if (Roles::isAdmin($user)) {
            AuditLogger::log('admin_viewed_dental_consultation', DentalConsultation::class, $dentalConsultation->id, null, [
                'patient_id'   => $dentalConsultation->patient_id,
                'patient_name' => $dentalConsultation->patient?->user?->name,
                'date'         => $dentalConsultation->consultation_date,
            ]);
        } else {
            AuditLogger::log('dental_consultation_accessed', DentalConsultation::class, $dentalConsultation->id);
        }

        return response()->json(['consultation' => $dentalConsultation]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! Roles::is($user, Roles::DENTIST)) {
            return response()->json(['message' => 'Only dentists can create dental consultation records.'], 403);
        }

        // Capture appointmentId but do NOT resolve service_name yet (fix #4: validate first)
        $appointmentId = $request->input('appointment_id');

        // Validate first (including appointment_id), THEN resolve service (fix #4)
        $validated = $request->validate(array_merge([
            'patient_id'          => ['required', 'integer', 'exists:patients,id'],
            'appointment_id'      => ['nullable', 'integer', Rule::exists('appointments', 'id')->where('appointment_type', 'dental'), Rule::unique('dental_consultations', 'appointment_id')],
            'emergency_override'  => ['nullable', 'boolean'],
            'emergency_reason'    => ['nullable', 'string', 'max:500'],
            'service_name'        => ConsultationServiceName::rules('dental', locked: (bool) $appointmentId),
            'consultation_date'   => ['required', 'date', 'date_format:Y-m-d'],
            'status'              => ['nullable', 'string', 'in:completed,pending,cancelled'],
            'reason_for_visit'    => ['nullable', 'string', 'max:10000'],
            'complaint_category'  => ['nullable', 'string', 'max:100'],
            'complaint_category_id' => ['nullable', 'integer', 'exists:complaint_categories,id'],
            'affected_teeth'      => ['nullable', 'array'],
            'affected_teeth.*'    => ['integer', 'min:1', 'max:52'],
            'dental_findings'     => ['nullable', 'string', 'max:10000'],
            'diagnosis'           => ['nullable', 'string', 'max:255'],
            'treatment_performed' => ['nullable', 'string', 'max:10000'],
            'recommendations'     => ['nullable', 'string', 'max:10000'],
            'notes'               => ['nullable', 'string', 'max:10000'],
            'staff_notes'         => ['nullable', 'string', 'max:10000'],
            'tooth_conditions'    => ['nullable', 'array'],
            'tooth_conditions.*'  => ['string', 'in:healthy,cavity,filled,extracted,missing,treated'],
            'inventory_items'     => ['nullable', 'array'],
            'inventory_items.*.item_id'  => ['required_with:inventory_items', 'integer', 'distinct', 'exists:inventory_items,id'],
            'inventory_items.*.quantity' => ['required_with:inventory_items', 'integer', 'min:1'],
            'inventory_items.*.dosage_note' => ['nullable', 'string', 'max:255'],
        ], VitalsRules::rules()), [
            'service_name.required'      => 'Please select the dental service for this consultation.',
            'service_name.exists'        => 'The selected service is not an available dental service.',
            'appointment_id.exists'      => 'That appointment is not a dental appointment.',
            'appointment_id.unique'      => 'That appointment already has a consultation record.',
            'inventory_items.*.item_id.distinct' => 'Each medicine or supply can only be listed once.',
        ]);

        // Now resolve service_name AFTER validation (fix #4)
        $validated['service_name'] = ConsultationServiceName::resolve($validated['service_name'], $validated['appointment_id'] ?? null);

        // Keep complaint_category (display name) and complaint_category_id in sync
        $validated = array_merge($validated, ComplaintCategoryResolver::resolve($validated));

        // Compute BMI server-side (fix #5)
        if (isset($validated['vitals'])) {
            $validated['vitals'] = VitalsRules::computeBMI($validated['vitals']);
        }

        $inventoryItems = $validated['inventory_items'] ?? [];

        // Only a COMPLETED consultation has side effects: it completes the linked appointment, updates the
        // dental chart and dispenses medicines. A pending or cancelled one is only saved.
        $status    = $validated['status'] ?? 'completed';
        $completed = $status === 'completed';
        $this->refuseDispenseUnlessCompleted($completed, $inventoryItems);

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

        // ONE transaction: the consultation, the appointment, the dental chart and the dispensed stock are
        // saved together. If stock is short or anything fails, none of it is kept and the API says so.
        $consultation = DB::transaction(function () use ($validated, $user, $request, $inventoryItems, $status, $completed) {
            // Locks the appointment, so a double click or retry cannot save a second consultation for it
            $appointment = AppointmentLink::claim(
                isset($validated['appointment_id']) ? (int) $validated['appointment_id'] : null,
                (int) $validated['patient_id'],
                DentalConsultation::class
            );

            $consultation = DentalConsultation::create([
                'patient_id'          => $validated['patient_id'],
                'appointment_id'      => $validated['appointment_id'] ?? null,
                'service_name'        => $validated['service_name'],
                'created_by'          => $user->id,
                'consultation_date'   => $validated['consultation_date'],
                'status'              => $status,
                'reason_for_visit'    => $validated['reason_for_visit'] ?? null,
                'vitals'              => $this->cleanVitals($validated['vitals'] ?? null),
                'complaint_category'  => $validated['complaint_category'] ?? null,
                'complaint_category_id' => $validated['complaint_category_id'] ?? null,
                'affected_teeth'      => $validated['affected_teeth'] ?? [],
                'dental_findings'     => $validated['dental_findings'] ?? null,
                'diagnosis'           => $validated['diagnosis'] ?? null,
                'treatment_performed' => $validated['treatment_performed'] ?? null,
                'recommendations'     => $validated['recommendations'] ?? null,
                'notes'               => $validated['notes'] ?? null,
                'staff_notes'         => $validated['staff_notes'] ?? null,
            ]);

            // Auto-complete appointment if linked (completed consultations only)
            if ($completed) {
                $appointment?->update(['status' => 'completed']);
            }

            // ── Auto-update Dental Chart ──────────────────────────────────────────
            // Map service/treatment to a chart condition. Dentist can also send
            // explicit per-tooth overrides via tooth_conditions[tooth_number] = condition.
            $affectedTeeth   = $validated['affected_teeth'] ?? [];
            $toothConditions = $validated['tooth_conditions'] ?? [];

            if ($completed && ! empty($affectedTeeth)) {
                // Derive a default condition from the service name or treatment performed
                $serviceName   = $request->input('service_name', '');
                $treatmentText = $validated['treatment_performed'] ?? '';

                $defaultCondition = $this->deriveCondition($serviceName, $treatmentText);

                // Only write chart entries if a meaningful condition is mapped
                // (null means "no auto-mapping" — dentist must have sent explicit tooth_conditions)
                $chart = DentalChart::firstOrCreate(['patient_id' => $validated['patient_id']]);

                foreach ($affectedTeeth as $toothNumber) {
                    // Dentist-confirmed per-tooth override takes priority
                    $condition = $toothConditions[(string) $toothNumber] ?? $defaultCondition;

                    if ($condition === null) {
                        // No mapping and no override — skip this tooth
                        continue;
                    }

                    // Build clinical notes from diagnosis/findings for the chart log
                    $chartNotes = implode(' | ', array_filter([
                        $validated['diagnosis'] ?? null,
                        $validated['dental_findings'] ?? null,
                        $validated['notes'] ?? null,
                    ]));

                    $entry = DentalChartTooth::create([
                        'dental_chart_id' => $chart->id,
                        'tooth_number'    => $toothNumber,
                        'condition'       => $condition,
                        'notes'           => $chartNotes ?: null,
                        'recorded_by'     => $user->id,
                    ]);

                    AuditLogger::log('dental_tooth_updated_via_consultation', DentalChartTooth::class, $entry->id, null, $entry->toArray());
                }
            }
            // ─────────────────────────────────────────────────────────────────────

            AuditLogger::log('dental_consultation_created', DentalConsultation::class, $consultation->id, null, $consultation->toArray());

            // Dispense inventory items (throws InsufficientStockException -> everything above is rolled back)
            if ($completed && !empty($inventoryItems)) {
                $patient = Patient::find($validated['patient_id']);
                InventoryController::dispenseForConsultation(
                    $inventoryItems,
                    'dental',
                    $consultation->id,
                    $patient?->user_id ?? 0,
                    $user->id,
                    $validated['consultation_date']
                );
            }

            return $consultation;
        }, 3);

        if ($walkInBlocker && $emergencyOverride) {
            AuditLogger::log('walk_in_emergency_override', DentalConsultation::class, $consultation->id, null, [
                'patient_id' => $consultation->patient_id,
                'reason'     => $emergencyReason,
                'readiness'  => $walkInBlocker['percent'],
            ]);
        }

        return response()->json([
            'message'      => 'Dental consultation record created successfully.',
            'consultation' => $consultation->load(['patient.user', 'appointment.service', 'dentist:' . Appointment::staffColumns()]),
        ], 201);
    }

    /** Medicines are only dispensed on a completed consultation: refuse a request that asks otherwise. */
    private function refuseDispenseUnlessCompleted(bool $completed, array $inventoryItems): void
    {
        if (! $completed && ! empty($inventoryItems)) {
            throw ValidationException::withMessages([
                'inventory_items' => 'Medicines and supplies can only be dispensed on a completed consultation.',
            ]);
        }
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

    /**
     * Derive a dental_chart_teeth condition from the booked service name or treatment text.
     * Returns null when the service/treatment does not cleanly map to a known condition
     * (forcing the dentist to provide an explicit tooth_conditions override).
     */
    private function deriveCondition(string $serviceName, string $treatmentText): ?string
    {
        $text = strtolower($serviceName . ' ' . $treatmentText);

        if (str_contains($text, 'extraction') || str_contains($text, 'extracted') || str_contains($text, 'remove')) {
            return 'extracted';
        }

        if (str_contains($text, 'filling') || str_contains($text, 'filled') || str_contains($text, 'restoration') || str_contains($text, 'composite')) {
            return 'filled';
        }

        if (str_contains($text, 'crown') || str_contains($text, 'root canal') || str_contains($text, 'endodontic')) {
            return 'treated';
        }

        if (str_contains($text, 'cavity') || str_contains($text, 'caries') || str_contains($text, 'decay')) {
            return 'cavity';
        }

        // Dental Cleaning / Dental Consultation with no explicit treatment signal → null
        // (do NOT auto-set healthy; dentist must confirm via tooth_conditions override)
        return null;
    }


    public function update(Request $request, DentalConsultation $dentalConsultation): JsonResponse
    {
        $user = $request->user();

        if (! Roles::is($user, Roles::DENTIST)) {
            return response()->json(['message' => 'Only dentists can modify dental consultation records.'], 403);
        }

        // Keep the saved service unless a different one is picked; a linked appointment's service always wins.
        $given          = ConsultationServiceName::resolve($request->input('service_name'), $dentalConsultation->appointment_id);
        $serviceChanged = $given !== null && $given !== $dentalConsultation->service_name;
        $request->merge(['service_name' => $given ?? $dentalConsultation->service_name]);

        $validated = $request->validate(array_merge([
            'service_name'        => ConsultationServiceName::rules('dental', locked: (bool) $dentalConsultation->appointment_id || ! $serviceChanged, required: false),
            'consultation_date'   => ['required', 'date', 'date_format:Y-m-d'],
            'status'              => ['nullable', 'string', 'in:completed,pending,cancelled'],
            'reason_for_visit'    => ['nullable', 'string', 'max:10000'],
            'complaint_category'  => ['nullable', 'string', 'max:100'],
            'complaint_category_id' => ['nullable', 'integer', 'exists:complaint_categories,id'],
            'affected_teeth'      => ['nullable', 'array'],
            'dental_findings'     => ['nullable', 'string', 'max:10000'],
            'diagnosis'           => ['nullable', 'string', 'max:255'],
            'treatment_performed' => ['nullable', 'string', 'max:10000'],
            'recommendations'     => ['nullable', 'string', 'max:10000'],
            'notes'               => ['nullable', 'string', 'max:10000'],
            'staff_notes'         => ['nullable', 'string', 'max:10000'],
            'inventory_items'     => ['nullable', 'array'],
            'inventory_items.*.item_id'  => ['required_with:inventory_items', 'integer', 'distinct', 'exists:inventory_items,id'],
            'inventory_items.*.quantity' => ['required_with:inventory_items', 'integer', 'min:1'],
            'inventory_items.*.dosage_note' => ['nullable', 'string', 'max:255'],
        ], VitalsRules::rules()), [
            'service_name.exists'       => 'The selected service is not an available dental service.',
            'inventory_items.*.item_id.distinct' => 'Each medicine or supply can only be listed once.',
        ]);

        $validated = array_merge($validated, ComplaintCategoryResolver::resolve($validated));

        // Compute BMI server-side (fix #5)
        if (array_key_exists('vitals', $validated)) {
            $validated['vitals'] = VitalsRules::computeBMI($this->cleanVitals($validated['vitals']));
        }

        $inventoryItems = $validated['inventory_items'] ?? [];

        // Same rule as when creating: stock is dispensed only while the consultation is completed. Changing a
        // consultation to pending / cancelled gives back what it had dispensed (the reversal below).
        $previousStatus = $dentalConsultation->status ?: 'completed';
        $completed      = ($validated['status'] ?? $previousStatus) === 'completed';
        $this->refuseDispenseUnlessCompleted($completed, $inventoryItems);

        DB::transaction(function () use ($validated, $user, $dentalConsultation, $inventoryItems, $completed, $previousStatus) {
            // Lock the record, and every item it dispensed before or will dispense now (sorted, once)
            DentalConsultation::whereKey($dentalConsultation->id)->lockForUpdate()->first(['id']);
            InventoryController::lockConsultationItems('dental', $dentalConsultation->id, $inventoryItems);

            $oldValues = $dentalConsultation->toArray();
            $dentalConsultation->update($validated);
            $newValues = $dentalConsultation->getChanges();

            // Give back what this record dispensed, then check the stock and dispense again.
            // The stock check happens AFTER the reversal, so re-saving a record never fails
            // because of its own earlier dispense.
            InventoryController::reverseConsultationTransactions('dental', $dentalConsultation->id);
            if ($completed && !empty($inventoryItems)) {
                $patient = Patient::find($dentalConsultation->patient_id);
                InventoryController::dispenseForConsultation(
                    $inventoryItems,
                    'dental',
                    $dentalConsultation->id,
                    $patient?->user_id ?? 0,
                    $user->id,
                    $validated['consultation_date']
                );
            }

            // Becoming completed completes the linked appointment, as a completed consultation does when created
            if ($completed && $previousStatus !== 'completed' && $dentalConsultation->appointment_id) {
                Appointment::whereKey($dentalConsultation->appointment_id)
                    ->whereIn('status', ['pending', 'confirmed'])
                    ->update(['status' => 'completed']);
                CacheVersion::bump('reports');   // a bulk update fires no model events
            }

            AuditLogger::log('dental_consultation_updated', DentalConsultation::class, $dentalConsultation->id, $oldValues, $newValues);
        }, 3);

        return response()->json([
            'message'      => 'Dental consultation record updated successfully.',
            'consultation' => $dentalConsultation->load(['patient.user', 'appointment.service', 'dentist:' . Appointment::staffColumns()]),
        ]);
    }
}
