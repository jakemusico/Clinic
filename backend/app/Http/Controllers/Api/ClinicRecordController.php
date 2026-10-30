<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClinicRecord;
use App\Models\Patient;
use App\Models\User;
use App\Models\Appointment;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

        $validated = $request->validate([
            'patient_id'       => ['required', 'integer', 'exists:patients,id'],
            'appointment_id'   => ['nullable', 'integer', 'exists:appointments,id'],
            'diagnosis'        => ['nullable', 'string', 'max:255'],
            'assessment'       => ['nullable', 'string'],
            'chief_complaint'  => ['nullable', 'string'],
            'complaint_category' => ['nullable', 'string', 'max:100'],
            'symptoms'         => ['nullable', 'string'],
            'treatment'        => ['nullable', 'string'],
            'recommendation'   => ['nullable', 'string'],
            'prescription'     => ['nullable', 'string'],
            'notes'            => ['nullable', 'string'],
            'remarks'          => ['nullable', 'string'],
            'visit_date'       => ['required', 'date', 'date_format:Y-m-d'],
            'vitals'           => ['nullable', 'array'],
            'inventory_items'  => ['nullable', 'array'],
            'inventory_items.*.item_id'  => ['required_with:inventory_items', 'integer', 'exists:inventory_items,id'],
            'inventory_items.*.quantity' => ['required_with:inventory_items', 'integer', 'min:1'],
        ]);

        // Pre-validate stock before creating the record
        $inventoryItems = $validated['inventory_items'] ?? [];
        if (!empty($inventoryItems)) {
            $stockErrors = InventoryController::preValidateStock($inventoryItems);
            if (!empty($stockErrors)) {
                return response()->json(['message' => implode(' ', $stockErrors)], 422);
            }
        }

        $diagnosis = $validated['diagnosis'] ?? $validated['assessment'] ?? $validated['chief_complaint'] ?? 'General Medical Consultation';
        $treatment = $validated['treatment'] ?? $validated['recommendation'] ?? null;

        $record = ClinicRecord::create([
            'patient_id'         => $validated['patient_id'],
            'appointment_id'     => $validated['appointment_id'] ?? null,
            'created_by'         => $user->id,
            'diagnosis'          => $diagnosis,
            'assessment'         => $validated['assessment'] ?? null,
            'chief_complaint'    => $validated['chief_complaint'] ?? null,
            'complaint_category' => $validated['complaint_category'] ?? null,
            'symptoms'           => $validated['symptoms'] ?? null,
            'prescription'    => $validated['prescription'] ?? null,
            'remarks'         => $validated['remarks'] ?? null,
            'treatment'       => $treatment,
            'recommendation'  => $validated['recommendation'] ?? null,
            'notes'           => $validated['notes'] ?? null,
            'vitals'          => $validated['vitals'] ?? null,
            'visit_date'      => $validated['visit_date'],
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
            $diagText = $record->diagnosis ?: ($record->assessment ?: 'Consultation');
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

        $validated = $request->validate([
            'appointment_id'   => ['nullable', 'integer', 'exists:appointments,id'],
            'diagnosis'        => ['nullable', 'string', 'max:255'],
            'assessment'       => ['nullable', 'string'],
            'chief_complaint'  => ['nullable', 'string'],
            'complaint_category' => ['nullable', 'string', 'max:100'],
            'symptoms'         => ['nullable', 'string'],
            'treatment'        => ['nullable', 'string'],
            'recommendation'   => ['nullable', 'string'],
            'prescription'     => ['nullable', 'string'],
            'notes'            => ['nullable', 'string'],
            'remarks'          => ['nullable', 'string'],
            'visit_date'       => ['required', 'date', 'date_format:Y-m-d'],
            'vitals'           => ['nullable', 'array'],
            'inventory_items'  => ['nullable', 'array'],
            'inventory_items.*.item_id'  => ['required_with:inventory_items', 'integer', 'exists:inventory_items,id'],
            'inventory_items.*.quantity' => ['required_with:inventory_items', 'integer', 'min:1'],
        ]);

        if (empty($validated['diagnosis']) && ! empty($validated['assessment'])) {
            $validated['diagnosis'] = $validated['assessment'];
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

        $patients = $users->map(function ($u) {
            $patient = Patient::firstOrCreate(['user_id' => $u->id]);
            return [
                'id'         => $patient->id,
                'user_id'    => $u->id,
                'name'       => $u->name,
                'email'      => $u->email,
                'student_id' => $u->student_id,
                'role'       => $u->role,
                'contact_no' => $u->contact_no,
                'department' => $u->department,
            ];
        });

        return response()->json(['patients' => $patients]);
    }
}
