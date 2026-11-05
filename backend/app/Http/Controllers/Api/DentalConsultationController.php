<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DentalConsultation;
use App\Models\DentalChart;
use App\Models\DentalChartTooth;
use App\Models\Patient;
use App\Models\Appointment;
use App\Services\AuditLogger;
use App\Services\ConsultationServiceName;
use App\Support\VitalsRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DentalConsultationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role === 'clinic_staff') {
            return response()->json(['message' => 'Forbidden. Nurse role cannot access dental consultations.'], 403);
        }

        $query = DentalConsultation::with(['patient.user', 'appointment.service', 'dentist']);

        if (in_array($user->role, ['student', 'faculty_staff'])) {
            $query->whereHas('patient', function ($q) use ($user) {
                $q->where('user_id', $user->id);
            })->where('status', 'completed');
        } else {
            if ($request->has('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('diagnosis', 'like', "%{$search}%")
                      ->orWhere('treatment_performed', 'like', "%{$search}%")
                      ->orWhere('dental_findings', 'like', "%{$search}%")
                      ->orWhereHas('patient.user', function ($qu) use ($search) {
                          $qu->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('student_id', 'like', "%{$search}%");
                      });
                });
            }

            if ($request->has('patient_id')) {
                $query->where('patient_id', $request->patient_id);
            }
        }

        $query->orderBy('consultation_date', 'desc')->orderBy('created_at', 'desc');

        if ($request->boolean('all') || $request->get('paginate') === 'false') {
            $consultations = $query->get();
            if (in_array($user->role, ['student', 'faculty_staff'])) {
                $consultations->makeHidden(['staff_notes']);
            }
            return response()->json([
                'data'          => $consultations,
                'consultations' => $consultations,
                'total'         => $consultations->count(),
                'current_page'  => 1,
                'last_page'     => 1,
                'per_page'      => $consultations->count(),
            ]);
        }

        $perPage = (int) $request->get('per_page', 10);
        $paginated = $query->paginate($perPage);

        if (in_array($user->role, ['student', 'faculty_staff'])) {
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
        ]);
    }

    public function show(Request $request, DentalConsultation $dentalConsultation): JsonResponse
    {
        $user = $request->user();

        if ($user->role === 'clinic_staff') {
            return response()->json(['message' => 'Forbidden. Nurse role cannot access dental consultations.'], 403);
        }

        if (in_array($user->role, ['student', 'faculty_staff'])) {
            $patient = Patient::where('user_id', $user->id)->first();
            if (! $patient || $dentalConsultation->patient_id !== $patient->id) {
                return response()->json(['message' => 'Forbidden. You can only view your own dental records.'], 403);
            }
            $dentalConsultation->makeHidden(['staff_notes']);
        }

        $dentalConsultation->load(['patient.user', 'appointment.service', 'dentist']);

        if ($user->role === 'admin') {
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

        if ($user->role !== 'dentist') {
            return response()->json(['message' => 'Only dentists can create dental consultation records.'], 403);
        }

        // Linked to an appointment: the service is the appointment's. Otherwise the dentist must pick a dental one.
        $appointmentId = $request->input('appointment_id');
        $request->merge([
            'service_name' => ConsultationServiceName::resolve($request->input('service_name'), $appointmentId),
        ]);

        // Required: patient, date, service, reason for the visit. Everything else is optional.
        $validated = $request->validate(array_merge([
            'patient_id'          => ['required', 'integer', 'exists:patients,id'],
            'appointment_id'      => ['nullable', 'integer', Rule::exists('appointments', 'id')->where('appointment_type', 'dental')],
            'service_name'        => ConsultationServiceName::rules('dental', locked: (bool) $appointmentId),
            'consultation_date'   => ['required', 'date', 'date_format:Y-m-d'],
            'status'              => ['nullable', 'string', 'in:completed,pending,cancelled'],
            'reason_for_visit'    => ['required', 'string'],
            'complaint_category'  => ['nullable', 'string', 'max:100'],
            'affected_teeth'      => ['nullable', 'array'],
            'affected_teeth.*'    => ['integer', 'min:1', 'max:52'],
            'dental_findings'     => ['nullable', 'string'],
            'diagnosis'           => ['nullable', 'string', 'max:255'],
            'treatment_performed' => ['nullable', 'string'],
            'recommendations'     => ['nullable', 'string'],
            'notes'               => ['nullable', 'string'],
            'staff_notes'         => ['nullable', 'string'],
            'tooth_conditions'    => ['nullable', 'array'],
            'tooth_conditions.*'  => ['string', 'in:healthy,cavity,filled,extracted,missing,treated'],
            'inventory_items'     => ['nullable', 'array'],
            'inventory_items.*.item_id'  => ['required_with:inventory_items', 'integer', 'exists:inventory_items,id'],
            'inventory_items.*.quantity' => ['required_with:inventory_items', 'integer', 'min:1'],
        ], VitalsRules::rules()), [
            'service_name.required'      => 'Please select the dental service for this consultation.',
            'service_name.exists'        => 'The selected service is not an available dental service.',
            'appointment_id.exists'      => 'That appointment is not a dental appointment.',
            'reason_for_visit.required'  => 'Please enter the reason for the visit / chief complaint.',
        ]);

        // Pre-validate inventory stock
        $inventoryItems = $validated['inventory_items'] ?? [];
        if (!empty($inventoryItems)) {
            $stockErrors = InventoryController::preValidateStock($inventoryItems);
            if (!empty($stockErrors)) {
                return response()->json(['message' => implode(' ', $stockErrors)], 422);
            }
        }

        $consultation = DentalConsultation::create([
            'patient_id'          => $validated['patient_id'],
            'appointment_id'      => $validated['appointment_id'] ?? null,
            'service_name'        => $validated['service_name'],
            'created_by'          => $user->id,
            'consultation_date'   => $validated['consultation_date'],
            'status'              => $validated['status'] ?? 'completed',
            'reason_for_visit'    => $validated['reason_for_visit'],
            'vitals'              => $this->cleanVitals($validated['vitals'] ?? null),
            'complaint_category'  => $validated['complaint_category'] ?? null,
            'affected_teeth'      => $validated['affected_teeth'] ?? [],
            'dental_findings'     => $validated['dental_findings'] ?? null,
            'diagnosis'           => $validated['diagnosis'] ?? null,
            'treatment_performed' => $validated['treatment_performed'] ?? null,
            'recommendations'     => $validated['recommendations'] ?? null,
            'notes'               => $validated['notes'] ?? null,
            'staff_notes'         => $validated['staff_notes'] ?? null,
        ]);

        // Auto-complete appointment if linked
        if ($consultation->appointment_id) {
            $appointment = Appointment::find($consultation->appointment_id);
            if ($appointment) {
                $appointment->update(['status' => 'completed']);
            }
        }

        // ── Auto-update Dental Chart ──────────────────────────────────────────
        // Map service/treatment to a chart condition. Dentist can also send
        // explicit per-tooth overrides via tooth_conditions[tooth_number] = condition.
        $affectedTeeth    = $validated['affected_teeth'] ?? [];
        $toothConditions  = $validated['tooth_conditions'] ?? [];

        if (! empty($affectedTeeth)) {
            // Derive a default condition from the service name or treatment performed
            $serviceName      = $request->input('service_name', '');
            $treatmentText    = $validated['treatment_performed'] ?? '';

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

        // Dispense inventory items
        if (!empty($inventoryItems)) {
            $patient = Patient::find($validated['patient_id']);
            $patientUserId = $patient?->user_id ?? 0;
            InventoryController::dispenseForConsultation(
                $inventoryItems,
                'dental',
                $consultation->id,
                $patientUserId,
                $user->id,
                $validated['consultation_date']
            );
        }

        return response()->json([
            'message'      => 'Dental consultation record created successfully.',
            'consultation' => $consultation->load(['patient.user', 'appointment.service', 'dentist']),
        ], 201);
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

        if ($user->role !== 'dentist') {
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
            'reason_for_visit'    => ['required', 'string'],
            'complaint_category'  => ['nullable', 'string', 'max:100'],
            'affected_teeth'      => ['nullable', 'array'],
            'dental_findings'     => ['nullable', 'string'],
            'diagnosis'           => ['nullable', 'string', 'max:255'],
            'treatment_performed' => ['nullable', 'string'],
            'recommendations'     => ['nullable', 'string'],
            'notes'               => ['nullable', 'string'],
            'staff_notes'         => ['nullable', 'string'],
            'inventory_items'     => ['nullable', 'array'],
            'inventory_items.*.item_id'  => ['required_with:inventory_items', 'integer', 'exists:inventory_items,id'],
            'inventory_items.*.quantity' => ['required_with:inventory_items', 'integer', 'min:1'],
        ], VitalsRules::rules()), [
            'service_name.exists'       => 'The selected service is not an available dental service.',
            'reason_for_visit.required' => 'Please enter the reason for the visit / chief complaint.',
        ]);

        if (array_key_exists('vitals', $validated)) {
            $validated['vitals'] = $this->cleanVitals($validated['vitals']);
        }

        // Pre-validate inventory stock
        $inventoryItems = $validated['inventory_items'] ?? [];
        if (!empty($inventoryItems)) {
            $stockErrors = InventoryController::preValidateStock($inventoryItems);
            if (!empty($stockErrors)) {
                return response()->json(['message' => implode(' ', $stockErrors)], 422);
            }
        }

        $oldValues = $dentalConsultation->toArray();
        $dentalConsultation->update($validated);
        $newValues = $dentalConsultation->getChanges();

        // Reverse old inventory transactions and re-dispense
        InventoryController::reverseConsultationTransactions('dental', $dentalConsultation->id);
        if (!empty($inventoryItems)) {
            $patient = Patient::find($dentalConsultation->patient_id);
            $patientUserId = $patient?->user_id ?? 0;
            InventoryController::dispenseForConsultation(
                $inventoryItems,
                'dental',
                $dentalConsultation->id,
                $patientUserId,
                $user->id,
                $validated['consultation_date']
            );
        }

        AuditLogger::log('dental_consultation_updated', DentalConsultation::class, $dentalConsultation->id, $oldValues, $newValues);

        return response()->json([
            'message'      => 'Dental consultation record updated successfully.',
            'consultation' => $dentalConsultation->load(['patient.user', 'appointment.service', 'dentist']),
        ]);
    }
}
