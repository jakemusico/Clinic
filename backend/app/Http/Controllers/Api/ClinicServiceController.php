<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClinicService;
use App\Support\CacheVersion;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClinicServiceController extends Controller
{
    /**
     * GET /api/clinic/services
     * All authenticated users can view active services.
     * Clinic staff & admin can see all (including inactive).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = ClinicService::query()->orderBy('name');

        // Non-staff/admin only see active services
        $seesInactive = in_array($user?->role, ['clinic_staff', 'dentist', 'admin']);
        if (! $seesInactive) {
            $query->where('is_active', true);
        }

        // ?care_type=medical|dental  -> only that kind of care (booking, nurse and dentist forms)
        // ?active=1                  -> only services that can still be used
        $careType = $request->query('care_type');
        $query->careType($careType);
        $activeOnly = $request->boolean('active');
        if ($activeOnly) {
            $query->where('is_active', true);
        }

        // Reference data: cached 5 minutes. The key holds everything the answer depends on (whether the
        // caller may see inactive services, and the filters); saving or deleting a service starts a new version.
        $services = Cache::remember(
            CacheVersion::key('services', 'list', $seesInactive ? 'staff' : 'patient', is_string($careType) ? $careType : 'any', $activeOnly ? 'active' : 'all'),
            300,
            fn () => $query->get()->toArray()
        );

        return response()->json([
            'services' => $services,
        ]);
    }

    /**
     * POST /api/clinic/services
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'             => ['required', 'string', 'max:200', 'unique:clinic_services'],
            'care_type'        => ['required', 'string', Rule::in(ClinicService::CARE_TYPES)],
            'description'      => ['nullable', 'string'],
            'duration_minutes' => ['required', 'integer', 'min:5', 'max:480'],
            'fee'              => ['required', 'numeric', 'min:0'],
            'is_active'        => ['boolean'],
        ]);

        $service = ClinicService::create($validated);

        return response()->json([
            'message' => 'Service created successfully.',
            'service' => $service,
        ], 201);
    }

    /**
     * GET /api/clinic/services/{id}
     */
    public function show(ClinicService $clinicService): JsonResponse
    {
        return response()->json(['service' => $clinicService]);
    }

    /**
     * PUT /api/clinic/services/{id}
     */
    public function update(Request $request, ClinicService $clinicService): JsonResponse
    {
        $validated = $request->validate([
            'name'             => ['required', 'string', 'max:200', 'unique:clinic_services,name,' . $clinicService->id],
            'care_type'        => ['required', 'string', Rule::in(ClinicService::CARE_TYPES)],
            'description'      => ['nullable', 'string'],
            'duration_minutes' => ['required', 'integer', 'min:5', 'max:480'],
            'fee'              => ['required', 'numeric', 'min:0'],
            'is_active'        => ['boolean'],
        ]);

        $clinicService->update($validated);

        return response()->json([
            'message' => 'Service updated successfully.',
            'service' => $clinicService->fresh(),
        ]);
    }

    /**
     * PATCH /api/clinic/services/{id}/toggle
     * Toggle the active/inactive status of a service.
     */
    public function toggle(ClinicService $clinicService): JsonResponse
    {
        $clinicService->update(['is_active' => ! $clinicService->is_active]);

        return response()->json([
            'message' => $clinicService->is_active
                ? 'Service activated.'
                : 'Service deactivated.',
            'service' => $clinicService,
        ]);
    }

    /**
     * DELETE /api/clinic/services/{id}
     */
    public function destroy(ClinicService $clinicService): JsonResponse
    {
        // Check if the service has any appointments before deleting
        if ($clinicService->appointments()->count() > 0) {
            return response()->json([
                'message' => 'Cannot delete a service that has existing appointments. Deactivate it instead.',
            ], 422);
        }

        $clinicService->delete();

        return response()->json(['message' => 'Service deleted successfully.']);
    }
}
