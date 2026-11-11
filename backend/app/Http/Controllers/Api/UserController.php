<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use App\Services\AuditLogger;
use App\Rules\PhilippineMobile;
use App\Support\NameRules;
use App\Support\Roles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * GET /api/roles or GET /api/admin/roles
     * Return list of all available roles.
     */
    public function roles(): JsonResponse
    {
        return response()->json(Role::orderBy('id')->get());
    }

    /**
     * GET /api/admin/users
     * List all users (Admin only).
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::with('roleRelation');

        if ($request->has('search') && $request->search != '') {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('student_id', 'like', "%{$search}%")
                  ->orWhere('department', 'like', "%{$search}%");
            });
        }

        if ($request->has('role') && $request->role != 'all') {
            $roleFilter = $request->role;
            $query->where(function ($q) use ($roleFilter) {
                $q->where('role', $roleFilter)
                  ->orWhereHas('roleRelation', function ($rq) use ($roleFilter) {
                      $rq->where('slug', $roleFilter);
                  });
                if ($roleFilter === 'clinic_staff') {
                    $q->orWhere('role', 'nurse')->orWhereHas('roleRelation', fn($rq) => $rq->where('slug', 'nurse'));
                } elseif ($roleFilter === 'nurse') {
                    $q->orWhere('role', 'clinic_staff')->orWhereHas('roleRelation', fn($rq) => $rq->where('slug', 'clinic_staff'));
                }
            });
        }

        if ($request->has('status') && $request->status != 'all') {
            $query->where('is_active', $request->status === 'active');
        }

        $users = $query->orderBy('name')->paginate((int) $request->get('per_page', 10));

        return response()->json($users);
    }

    /**
     * POST /api/admin/users
     * Create a user manually (Admin only).
     */
    public function store(Request $request): JsonResponse
    {
        $role = $request->input('role', 'student');
        if ($request->filled('role_id')) {
            $roleObj = Role::find($request->input('role_id'));
            if ($roleObj) {
                $role = $roleObj->slug;
            }
        }

        $rules = $this->baseRules($role);
        $rules['password'] = ['required', 'string', 'min:8'];

        $validated = $request->validate($rules, NameRules::messages(['title', 'first_name', 'middle_name', 'last_name']) + ['contact_no.unique' => PhilippineMobile::UNIQUE_MESSAGE]);

        $userData = $this->buildUserData($validated, $role);
        $userData['password'] = Hash::make($validated['password']);

        $roleId = Arr::pull($userData, 'role_id');   // not mass-assignable: set below
        $user = new User($userData);   // only the mass-assignable columns
        $this->assignAccessFields($user, $validated, $role, (int) $roleId);
        $user->is_active            = true;
        $user->must_change_password = true; // admin-created accounts must change password on first login
        $user->save();

        AuditLogger::log(
            'user_created',
            User::class,
            $user->id,
            null,
            ['name' => $user->name, 'email' => $user->email, 'role' => $user->role_slug]
        );

        return response()->json([
            'message' => 'User created successfully.',
            'user'    => $user->load('roleRelation'),
        ], 201);
    }

    /**
     * PUT /api/admin/users/{user}
     * Update user details and role (Admin only).
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $role = $request->input('role', $user->role_slug);
        if ($request->filled('role_id')) {
            $roleObj = Role::find($request->input('role_id'));
            if ($roleObj) {
                $role = $roleObj->slug;
            }
        }

        $rules = $this->baseRules($role, $user->id);
        if ($request->filled('password')) {
            $rules['password'] = ['string', 'min:8'];
        }

        $validated = $request->validate($rules, NameRules::messages(['title', 'first_name', 'middle_name', 'last_name']) + ['contact_no.unique' => PhilippineMobile::UNIQUE_MESSAGE]);

        $oldValues = $user->toArray();
        $oldRole   = $user->role_slug;

        $userData = $this->buildUserData($validated, $role);

        if ($request->filled('password')) {
            $userData['password'] = Hash::make($validated['password']);
        }

        $roleId = Arr::pull($userData, 'role_id');   // not mass-assignable: set below
        $user->fill($userData);   // only the mass-assignable columns
        $this->assignAccessFields($user, $validated, $role, (int) $roleId);
        if ($request->filled('password')) {
            $user->must_change_password = true;   // the admin chose this password: the user must replace it
        }
        $user->save();

        // The password was reset by an admin: every existing session of that user is revoked.
        if ($request->filled('password')) {
            $user->tokens()->delete();
        }

        $newValues = $user->getChanges();

        if ($oldRole !== $user->role_slug) {
            AuditLogger::log(
                'role_changed',
                User::class,
                $user->id,
                ['role' => $oldRole],
                ['role' => $user->role_slug]
            );
        }

        AuditLogger::log(
            'user_updated',
            User::class,
            $user->id,
            $oldValues,
            $newValues
        );

        return response()->json([
            'message' => 'User updated successfully.',
            'user'    => $user->load('roleRelation'),
        ]);
    }

    /**
     * PATCH /api/admin/users/{user}/toggle
     * Toggle active status of user (Admin only).
     */
    public function toggleStatus(User $user): JsonResponse
    {
        $oldValues = ['is_active' => $user->is_active];
        $user->is_active = ! $user->is_active;   // not mass-assignable, set explicitly
        $user->save();
        $newValues = ['is_active' => $user->is_active];

        // A deactivated account is signed out everywhere at once.
        if (! $user->is_active) {
            $user->tokens()->delete();
        }

        AuditLogger::log(
            'user_status_toggled',
            User::class,
            $user->id,
            $oldValues,
            $newValues
        );

        $statusStr = $user->is_active ? 'activated' : 'deactivated';

        return response()->json([
            'message' => "User account has been {$statusStr}.",
            'user'    => $user->load('roleRelation'),
        ]);
    }

    /**
     * GET /api/search-patients
     * Quick search for Nurse and Dentist dashboard.
     */
    public function searchPatients(Request $request): JsonResponse
    {
        $user = $request->user();
        $allowedStaff = ['clinic_staff', 'nurse', 'dentist', 'admin'];
        if (!in_array($user->role_slug, $allowedStaff) && !in_array($user->attributes['role'] ?? '', $allowedStaff)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = User::query()
            ->where(function ($q) {
                $q->whereIn('role', ['student', 'faculty_staff'])
                  ->orWhereHas('roleRelation', function ($rq) {
                      $rq->whereIn('slug', ['student', 'faculty_staff']);
                  });
            })
            ->where('is_active', true);

        if ($request->has('query') && $request->query('query') != '') {
            $search = $request->query('query');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('student_id', 'like', "%{$search}%");
            });
        }

        $users = $query->limit(5)->get(['id', 'name', 'first_name', 'middle_name', 'last_name', 'suffix', 'student_id', 'role', 'role_id', 'grade_level', 'section', 'avatar']);

        return response()->json(['users' => $users]);
    }

    /**
     * GET /api/clinic/people
     */
    public function peopleList(Request $request): JsonResponse
    {
        $user = $request->user();
        $allowedStaff = ['clinic_staff', 'nurse', 'dentist', 'admin'];
        if (!in_array($user->role_slug, $allowedStaff) && !in_array($user->attributes['role'] ?? '', $allowedStaff)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $type = $request->query('type', 'student'); // 'student' or 'faculty_staff'
        
        $query = User::query()
            ->where(function ($q) use ($type) {
                $q->where('role', $type)
                  ->orWhereHas('roleRelation', function ($rq) use ($type) {
                      $rq->where('slug', $type);
                  });
            })
            ->where('is_active', true);

        if ($request->has('search') && $request->query('search') != '') {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('student_id', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('grade_level', 'like', "%{$search}%")
                  ->orWhere('section', 'like', "%{$search}%")
                  ->orWhere('department', 'like', "%{$search}%");
            });
        }

        if ($type === 'student') {
            if ($request->filled('grade_level')) {
                $query->where('grade_level', $request->query('grade_level'));
            }
            if ($request->filled('section')) {
                $query->where('section', $request->query('section'));
            }
        } elseif ($type === 'faculty_staff') {
            if ($request->filled('department')) {
                $query->where('department', $request->query('department'));
            }
        }

        $users = $query->with('patient')->orderBy('last_name')->paginate((int) $request->get('per_page', 10));

        return response()->json($users);
    }

    /**
     * GET /api/clinic/people/{user}
     */
    public function personProfile(Request $request, User $user): JsonResponse
    {
        $authUser = $request->user();
        $allowedStaff = ['clinic_staff', 'nurse', 'dentist', 'admin'];
        if (!in_array($authUser->role_slug, $allowedStaff) && !in_array($authUser->attributes['role'] ?? '', $allowedStaff) && $authUser->id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user->load([
            'patient',
            'roleRelation',
            'clinicRecordsCreated' => function($q) { $q->latest()->limit(5); },
            'appointmentsAsStaff' => function($q) { $q->latest()->limit(5); }
        ]);

        $appointments = \App\Models\Appointment::with(['service'])
            ->whereHas('patient', function ($q) use ($user) {
                $q->where('user_id', $user->id);
            })
            ->latest()
            ->limit(10)
            ->get();

        if ($authUser->isAdmin()) {
            AuditLogger::log('admin_viewed_patient_record', User::class, $user->id, null, [
                'patient_name' => $user->name,
                'student_id'   => $user->student_id,
                'patient_id'   => $user->patient?->id,
            ]);
        }

        return response()->json([
            'user' => $user,
            'appointments' => $appointments
        ]);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Build shared validation rules for create / update.
     */
    private function baseRules(string $role, ?int $ignoreId = null): array
    {
        $uniqueEmail = Rule::unique('users', 'email');
        $uniqueId    = Rule::unique('users', 'student_id');
        if ($ignoreId) {
            $uniqueEmail = $uniqueEmail->ignore($ignoreId);
            $uniqueId    = $uniqueId->ignore($ignoreId);
        }

        $rules = [
            'title'       => ['nullable', 'string', 'max:50', ...NameRules::person()],
            'first_name'  => ['required', 'string', 'max:100', ...NameRules::person()],
            'middle_name' => ['nullable', 'string', 'max:100', ...NameRules::person()],
            'last_name'   => ['required', 'string', 'max:100', ...NameRules::person()],
            'suffix'      => ['nullable', 'string', 'max:50', ...NameRules::suffix()],
            'email'       => ['required', 'string', 'email', 'max:255', $uniqueEmail],
            'role'        => ['nullable', 'string'],
            'role_id'     => ['nullable', 'integer', 'exists:roles,id'],
            // A valid PH mobile, unique among users (an unchanged number is not re-checked)
            'contact_no'  => ['nullable', 'string', ...PhilippineMobile::ownNumber($ignoreId, request()->input('contact_no'))],
        ];

        // Role-specific rules
        if ($role === 'student') {
            $rules['student_id']  = ['required', 'string', 'max:50', $uniqueId];
            $rules['grade_level'] = ['required', 'string', 'max:50'];
            $rules['section']     = ['required', 'string', 'max:100'];
        } else {
            $rules['student_id']  = ['nullable', 'string', 'max:50', $uniqueId];
            $rules['department']  = ['nullable', 'string', 'max:150'];
        }

        if ($role === 'dentist') {
            $rules['specialization'] = ['nullable', 'string', 'max:150'];
            $rules['license_no']     = ['nullable', 'string', 'max:100'];
        } elseif (in_array($role, ['clinic_staff', 'nurse'])) {
            $rules['license_no'] = ['nullable', 'string', 'max:100'];
        }

        // Admin: has_medical_access flag
        if ($role === 'admin') {
            $rules['has_medical_access'] = ['nullable', 'boolean'];
        }

        return $rules;
    }

    /**
     * Extract user data from validated payload for the given role.
     */
    private function buildUserData(array $validated, string $role): array
    {
        // Auto-assign title if blank
        $title = $validated['title'] ?? null;
        if (empty($title)) {
            if ($role === 'dentist') $title = 'Dr.';
            elseif (in_array($role, ['clinic_staff', 'nurse'])) $title = 'Nurse';
        }

        // Resolve role_id
        $roleId = $validated['role_id'] ?? null;
        if (!$roleId) {
            // The roles table may call the nurse role 'clinic_staff' or 'nurse': look for either spelling
            $canonical = Roles::of($role) ?? $role;
            $slugs = array_unique(array_filter([$canonical, $role, $canonical === Roles::NURSE ? 'nurse' : null]));
            $roleObj = Role::whereIn('slug', $slugs)->first();
            $roleId = $roleObj?->id ?? 4;   // unknown role: the least privileged one (student)
        }

        $data = [
            'title'       => $title,
            'first_name'  => $validated['first_name'],
            'middle_name' => $validated['middle_name'] ?? null,
            'last_name'   => $validated['last_name'],
            'suffix'      => $validated['suffix'] ?? null,
            'email'       => $validated['email'],
            'role_id'     => $roleId,
            'contact_no'  => $validated['contact_no'] ?? null,
            // Clear all role-specific fields first; re-populate below per role
            'student_id'    => null,
            'department'    => null,
            'grade_level'   => null,
            'section'       => null,
            'license_no'    => null,
            'specialization'=> null,
        ];

        if ($role === 'student') {
            $data['student_id']  = $validated['student_id'] ?? null;
            $data['grade_level'] = $validated['grade_level'] ?? null;
            $data['section']     = $validated['section'] ?? null;
        } else {
            $data['student_id'] = $validated['student_id'] ?? null;
            $data['department'] = $validated['department'] ?? null;
        }

        if ($role === 'dentist') {
            $data['specialization'] = $validated['specialization'] ?? null;
            $data['license_no']     = $validated['license_no'] ?? null;
        } elseif (in_array($role, ['clinic_staff', 'nurse'])) {
            $data['license_no'] = $validated['license_no'] ?? null;
        }

        return $data;
    }

    /**
     * Set the access columns that are NOT mass-assignable (role_id, role, has_medical_access).
     * Only the admin routes reach this, after the admin's own role was checked by the route middleware.
     */
    private function assignAccessFields(User $user, array $validated, string $role, int $roleId): void
    {
        $user->role_id = $roleId;
        // Canonical slug (nurse -> clinic_staff) so it always fits the users.role column
        $user->role = Roles::of($role) ?? $role;

        if ($role === 'admin' && isset($validated['has_medical_access'])) {
            $user->has_medical_access = (bool) $validated['has_medical_access'];
        }
    }
}
