<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DentalChart;
use App\Models\DentalChartTooth;
use App\Models\Patient;
use App\Services\AuditLogger;
use App\Support\Roles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DentalChartController extends Controller
{
    /**
     * GET /api/dental/chart/{patientId}
     * Get or create a patient's dental chart with tooth statuses and history.
     */
    public function show(Request $request, int $patientId): JsonResponse
    {
        $user = $request->user();

        // Allow-list: dentist and admin (dental care), or a patient looking at their own chart.
        if (! Roles::canAccessCare($user, Roles::DENTAL) && ! Roles::isPatient($user)) {
            return response()->json(['message' => 'Forbidden. Only the dentist, an administrator or the patient can access dental charts.'], 403);
        }

        if (Roles::isPatient($user)) {
            $patient = Patient::where('user_id', $user->id)->first();
            if (! $patient || $patient->id !== $patientId) {
                return response()->json(['message' => 'Forbidden. You can only view your own dental chart.'], 403);
            }
        }

        $patient = Patient::findOrFail($patientId);
        $chart = DentalChart::firstOrCreate(['patient_id' => $patient->id]);

        // Fetch all history for teeth in chart
        $history = DentalChartTooth::where('dental_chart_id', $chart->id)
            ->with('recordedBy:id,name')
            ->orderBy('created_at', 'desc')
            ->get();

        // Map latest condition for each tooth (1 to 32 universal / FDI notation)
        $latestTeethMap = [];
        foreach ($history as $entry) {
            if (! isset($latestTeethMap[$entry->tooth_number])) {
                $latestTeethMap[$entry->tooth_number] = $entry;
            }
        }

        if (Roles::isAdmin($user)) {
            AuditLogger::log('admin_viewed_dental_chart', DentalChart::class, $chart->id, null, [
                'patient_id'   => $patientId,
                'patient_name' => $patient->user?->name,
            ]);
        }

        return response()->json([
            'chart_id'       => $chart->id,
            'patient_id'     => $patient->id,
            'latest_teeth'   => $latestTeethMap,
            'history'        => $history,
        ]);
    }

    /**
     * POST /api/dental/chart/{patientId}/tooth
     * Record a condition change for a tooth (creates new history record).
     */
    public function updateTooth(Request $request, int $patientId): JsonResponse
    {
        $user = $request->user();

        if (! Roles::is($user, Roles::DENTIST)) {
            return response()->json(['message' => 'Only dentists can update dental chart records.'], 403);
        }

        $patient = Patient::findOrFail($patientId);
        $chart = DentalChart::firstOrCreate(['patient_id' => $patient->id]);

        $validated = $request->validate([
            'tooth_number' => ['required', 'integer', 'min:1', 'max:52'],
            'condition'    => ['required', 'string', 'in:healthy,cavity,filled,extracted,missing,treated'],
            'notes'        => ['nullable', 'string', 'max:500'],
        ]);

        $entry = DentalChartTooth::create([
            'dental_chart_id' => $chart->id,
            'tooth_number'    => $validated['tooth_number'],
            'condition'       => $validated['condition'],
            'notes'           => $validated['notes'] ?? null,
            'recorded_by'     => $user->id,
        ]);

        AuditLogger::log('dental_tooth_updated', DentalChartTooth::class, $entry->id, null, $entry->toArray());

        return response()->json([
            'message' => "Tooth #{$validated['tooth_number']} condition updated to {$validated['condition']}.",
            'entry'   => $entry->load('recordedBy:id,name'),
        ], 201);
    }
}
