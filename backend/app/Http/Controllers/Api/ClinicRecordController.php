<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClinicRecord;
use App\Models\DentalConsultation;
use App\Models\Patient;
use App\Models\User;
use App\Models\Appointment;
use App\Services\AuditLogger;
use App\Services\ConsultationServiceName;
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

        if ($user->role === 'dentist') {
            return response()->json(['message' => 'Forbidden. Dentists cannot access medical clinic records.'], 403);
        }

        if ($user->role === 'admin') {
            AuditLogger::log('admin_viewed_medical_records', ClinicRecord::class, null, null, [
                'search'     => $request->search ?? null,
                'patient_id' => $request->patient_id ?? null,
            ]);
        }

        $query = ClinicRecord::with(['patient.user', 'appointment.service', 'createdBy']);

        if (in_array($user->role, ['student', 'faculty_staff'])) {
            $query->whereHas('patient', function ($q) use ($user) {
                $q->where('user_id', $user->id);
            });
        } else {
            if ($request->has('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('diagnosis', 'like', "%{$search}%")
                      ->orWhere('treatment', 'like', "%{$search}%")
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

        $query->orderBy('visit_date', 'desc')->orderBy('created_at', 'desc');

        if ($request->boolean('all') || $request->get('paginate') === 'false') {
            $records = $query->get();
            return response()->json([
                'data'         => $records,
                'records'      => $records,
                'total'        => $records->count(),
                'current_page' => 1,
                'last_page'    => 1,
                'per_page'     => $records->count(),
            ]);
        }

        $perPage = (int) $request->get('per_page', 10);
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
        ]);
    }

    public function show(Request $request, ClinicRecord $clinicRecord): JsonResponse
    {
        $user = $request->user();

        if ($user->role === 'dentist') {
            return response()->json(['message' => 'Forbidden. Dentists cannot access medical clinic records.'], 403);
        }

        if (in_array($user->role, ['student', 'faculty_staff'])) {
            $patient = Patient::where('user_id', $user->id)->first();
            if (! $patient || $clinicRecord->patient_id !== $patient->id) {
                return response()->json(['message' => 'Forbidden. You can only view your own records.'], 403);
            }
        }

        $clinicRecord->load(['patient.user', 'appointment.service', 'createdBy']);

        if ($user->role === 'admin') {
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

        if ($user->role !== 'clinic_staff') {
            return response()->json(['message' => 'Only nurse/clinic staff can create medical patient records.'], 403);
        }

        // Linked to an appointment: the service is the appointment's. Otherwise the nurse must pick a medical one.
        $appointmentId = $request->input('appointment_id');
        $request->merge([
            'service_name' => ConsultationServiceName::resolve($request->input('service_name'), $appointmentId),
        ]);

        // Required: patient, date, service, reason for the visit. Everything else is optional.
        $validated = $request->validate(array_merge([
            'patient_id'       => ['required', 'integer', 'exists:patients,id'],
            'appointment_id'   => ['nullable', 'integer', Rule::exists('appointments', 'id')->where('appointment_type', 'medical')],
            'service_name'     => ConsultationServiceName::rules('medical', locked: (bool) $appointmentId),
            'visit_date'       => ['required', 'date', 'date_format:Y-m-d'],
            'chief_complaint'  => ['required', 'string'],
            'diagnosis'        => ['nullable', 'string', 'max:255'],
            'assessment'       => ['nullable', 'string'],
            'complaint_category' => ['nullable', 'string', 'max:100'],
            'symptoms'         => ['nullable', 'string'],
            'treatment'        => ['nullable', 'string'],
            'recommendation'   => ['nullable', 'string'],
            'prescription'     => ['nullable', 'string'],
            'notes'            => ['nullable', 'string'],
            'remarks'          => ['nullable', 'string'],
            'inventory_items'  => ['nullable', 'array'],
            'inventory_items.*.item_id'  => ['required_with:inventory_items', 'integer', 'exists:inventory_items,id'],
            'inventory_items.*.quantity' => ['required_with:inventory_items', 'integer', 'min:1'],
        ], VitalsRules::rules()), [
            'service_name.required'   => 'Please select the clinic service for this consultation.',
            'service_name.exists'     => 'The selected service is not an available medical service.',
            'appointment_id.exists'   => 'That appointment is not a medical appointment.',
            'chief_complaint.required' => 'Please enter the reason for the visit / chief complaint.',
        ]);

        // Pre-validate stock before creating the record
        $inventoryItems = $validated['inventory_items'] ?? [];
        if (!empty($inventoryItems)) {
            $stockErrors = InventoryController::preValidateStock($inventoryItems);
            if (!empty($stockErrors)) {
                return response()->json(['message' => implode(' ', $stockErrors)], 422);
            }
        }

        $record = ClinicRecord::create([
            'patient_id'         => $validated['patient_id'],
            'appointment_id'     => $validated['appointment_id'] ?? null,
            'service_name'       => $validated['service_name'],
            'created_by'         => $user->id,
            'diagnosis'          => $validated['diagnosis'] ?? null,
            'assessment'         => $validated['assessment'] ?? null,
            'chief_complaint'    => $validated['chief_complaint'],
            'complaint_category' => $validated['complaint_category'] ?? null,
            'symptoms'           => $validated['symptoms'] ?? null,
            'prescription'       => $validated['prescription'] ?? null,
            'remarks'            => $validated['remarks'] ?? null,
            'treatment'          => $validated['treatment'] ?? $validated['recommendation'] ?? null,
            'recommendation'     => $validated['recommendation'] ?? null,
            'notes'              => $validated['notes'] ?? null,
            'vitals'             => $this->cleanVitals($validated['vitals'] ?? null),
            'visit_date'         => $validated['visit_date'],
        ]);

        if ($record->appointment_id) {
            $appointment = Appointment::find($record->appointment_id);
            if ($appointment) {
                $appointment->update(['status' => 'completed']);
            }
        }

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

        // Dispense inventory items
        if (!empty($inventoryItems)) {
            $patient = Patient::find($record->patient_id);
            $patientUserId = $patient?->user_id ?? 0;
            InventoryController::dispenseForConsultation(
                $inventoryItems,
                'medical',
                $record->id,
                $patientUserId,
                $user->id,
                $validated['visit_date']
            );
        }

        return response()->json([
            'message' => 'Consultation record saved to patient medical record successfully.',
            'record'  => $record->load(['patient.user', 'appointment.service', 'createdBy']),
        ], 201);
    }

    public function update(Request $request, ClinicRecord $clinicRecord): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'clinic_staff') {
            return response()->json(['message' => 'Only nurse/clinic staff can modify medical patient records.'], 403);
        }

        // Keep the saved service unless a different one is picked; a linked appointment's service always wins.
        $appointmentId = $request->exists('appointment_id') ? $request->input('appointment_id') : $clinicRecord->appointment_id;
        $given         = ConsultationServiceName::resolve($request->input('service_name'), $appointmentId);
        $serviceChanged = $given !== null && $given !== $clinicRecord->service_name;
        $request->merge(['service_name' => $given ?? $clinicRecord->service_name]);

        $validated = $request->validate(array_merge([
            'appointment_id'   => ['nullable', 'integer', Rule::exists('appointments', 'id')->where('appointment_type', 'medical')],
            'service_name'     => ConsultationServiceName::rules('medical', locked: (bool) $appointmentId || ! $serviceChanged, required: false),
            'visit_date'       => ['required', 'date', 'date_format:Y-m-d'],
            'chief_complaint'  => ['required', 'string'],
            'diagnosis'        => ['nullable', 'string', 'max:255'],
            'assessment'       => ['nullable', 'string'],
            'complaint_category' => ['nullable', 'string', 'max:100'],
            'symptoms'         => ['nullable', 'string'],
            'treatment'        => ['nullable', 'string'],
            'recommendation'   => ['nullable', 'string'],
            'prescription'     => ['nullable', 'string'],
            'notes'            => ['nullable', 'string'],
            'remarks'          => ['nullable', 'string'],
            'inventory_items'  => ['nullable', 'array'],
            'inventory_items.*.item_id'  => ['required_with:inventory_items', 'integer', 'exists:inventory_items,id'],
            'inventory_items.*.quantity' => ['required_with:inventory_items', 'integer', 'min:1'],
        ], VitalsRules::rules()), [
            'service_name.exists'      => 'The selected service is not an available medical service.',
            'appointment_id.exists'    => 'That appointment is not a medical appointment.',
            'chief_complaint.required' => 'Please enter the reason for the visit / chief complaint.',
        ]);

        if (array_key_exists('vitals', $validated)) {
            $validated['vitals'] = $this->cleanVitals($validated['vitals']);
        }

        // Pre-validate stock before saving
        $inventoryItems = $validated['inventory_items'] ?? [];
        if (!empty($inventoryItems)) {
            $stockErrors = InventoryController::preValidateStock($inventoryItems);
            if (!empty($stockErrors)) {
                return response()->json(['message' => implode(' ', $stockErrors)], 422);
            }
        }

        $oldValues = $clinicRecord->toArray();
        $clinicRecord->update($validated);
        $newValues = $clinicRecord->getChanges();

        // Reverse old inventory transactions and re-dispense
        InventoryController::reverseConsultationTransactions('medical', $clinicRecord->id);
        if (!empty($inventoryItems)) {
            $patient = Patient::find($clinicRecord->patient_id);
            $patientUserId = $patient?->user_id ?? 0;
            InventoryController::dispenseForConsultation(
                $inventoryItems,
                'medical',
                $clinicRecord->id,
                $patientUserId,
                $user->id,
                $validated['visit_date']
            );
        }

        AuditLogger::log('record_updated', ClinicRecord::class, $clinicRecord->id, $oldValues, $newValues);

        return response()->json([
            'message' => 'Patient medical record updated successfully.',
            'record'  => $clinicRecord->load(['patient.user', 'appointment.service', 'createdBy']),
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

        if (! in_array($user->role, ['clinic_staff', 'dentist', 'admin'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($user->role === 'admin') {
            AuditLogger::log('admin_viewed_patient_list', Patient::class);
        }

        $search = $request->query('search');

        $users = User::whereIn('role', ['student', 'faculty_staff'])
            ->when($search, function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%")
                      ->orWhere('student_id', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->get();

        // One query for the existing patient profiles, then create any that are missing
        $profiles = Patient::whereIn('user_id', $users->pluck('id'))->get()->keyBy('user_id');
        foreach ($users as $u) {
            if (! $profiles->has($u->id)) {
                $profiles[$u->id] = Patient::create(['user_id' => $u->id]);
            }
        }

        // Date of the last visit, per kind of care (shown on the consultation form)
        $lastMedical = ClinicRecord::selectRaw('patient_id, MAX(visit_date) as last_visit')
            ->groupBy('patient_id')->pluck('last_visit', 'patient_id');
        $lastDental = DentalConsultation::selectRaw('patient_id, MAX(consultation_date) as last_visit')
            ->groupBy('patient_id')->pluck('last_visit', 'patient_id');

        $patients = $users->map(function ($u) use ($profiles, $lastMedical, $lastDental) {
            $patient = $profiles[$u->id];
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
                'allergies'           => $patient->allergies,
                'last_medical_visit'  => $lastMedical[$patient->id] ?? null,
                'last_dental_visit'   => $lastDental[$patient->id] ?? null,
            ];
        })->values();

        return response()->json(['patients' => $patients]);
    }
}
