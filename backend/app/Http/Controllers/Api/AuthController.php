<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use App\Models\Role;
use App\Services\AuditLogger;
use App\Rules\PhilippineMobile;
use App\Support\NameRules;
use App\Support\ProfileReadiness;
use Laravel\Sanctum\PersonalAccessToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Register a new user.
     * Public registration is restricted to 'student' and 'faculty_staff' roles only.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name'            => ['required', 'string', 'max:100', ...NameRules::person()],
            'middle_name'           => ['nullable', 'string', 'max:100', ...NameRules::person()],
            'last_name'             => ['required', 'string', 'max:100', ...NameRules::person()],
            'suffix'                => ['nullable', 'string', 'max:50', ...NameRules::suffix()],
            'email'                 => ['required', 'string', 'email', 'max:255', 'unique:users', 'regex:/@urios\.edu\.ph$/i'],
            'password'              => ['required', 'confirmed', Password::min(8)],
            'role'                  => ['required', 'string', 'in:student,faculty_staff'],
            'date_of_birth'         => ['required', 'date', 'before:today'],
            'sex'                   => ['required', 'string', 'in:male,female'],
            'contact_no'            => ['nullable', 'string', ...PhilippineMobile::ownNumber()],
            'address'               => ['nullable', 'string', 'max:500'],
            'terms_accepted'        => ['required', 'accepted'],
            // Student-only fields
            'student_id'            => ['nullable', 'string', 'max:50', 'unique:users'],
            'grade_level'           => ['nullable', 'string', 'max:50'],
            'section'               => [
                'nullable',
                'string',
                'max:100',
                \Illuminate\Validation\Rule::exists('sections', 'name')->where(function ($query) use ($request) {
                    return $query->where('grade_level', $request->grade_level);
                }),
            ],
            'guardian_name'         => ['nullable', 'string', 'max:255'],
            'guardian_relationship' => ['nullable', 'string', 'max:100'],
            'guardian_contact'      => ['nullable', 'string', new PhilippineMobile()],
            // Faculty-only fields
            'department'            => ['nullable', 'string', 'max:255'],
        ], NameRules::messages() + [
            'contact_no.unique' => PhilippineMobile::UNIQUE_MESSAGE,
            'email.regex'       => 'Please use your @urios.edu.ph email address.',
        ]);

        // Extra required validation for student role
        if ($validated['role'] === 'student') {
            $studentRequired = ['student_id', 'grade_level', 'section', 'guardian_name', 'guardian_relationship', 'guardian_contact', 'contact_no', 'address'];
            $errors = [];
            foreach ($studentRequired as $field) {
                if (empty($validated[$field])) {
                    $errors[$field] = [ucfirst(str_replace('_', ' ', $field)) . ' is required for students.'];
                }
            }
            if (!empty($errors)) {
                throw \Illuminate\Validation\ValidationException::withMessages($errors);
            }
        }

        // Auto-compute age from date_of_birth
        $age = \Carbon\Carbon::parse($validated['date_of_birth'])->age;

        $roleSlug = $validated['role'];
        $roleModel = Role::where('slug', $roleSlug)->first();
        $roleId = $roleModel?->id ?? ($roleSlug === 'student' ? 4 : 5);

        // The account and its patient profile are created together: if either fails, neither is kept.
        // Students and faculty/staff both get a patient row (guardian details are for students only).
        $user = DB::transaction(function () use ($validated, $roleId, $roleSlug, $age) {
            $user = new User([
                'first_name'            => $validated['first_name'],
                'middle_name'           => $validated['middle_name'] ?? null,
                'last_name'             => $validated['last_name'],
                'suffix'                => $validated['suffix'] ?? null,
                'email'                 => $validated['email'],
                'password'              => $validated['password'],
                'date_of_birth'         => $validated['date_of_birth'],
                'sex'                   => $validated['sex'],
                'age'                   => $age,
                'student_id'            => $validated['student_id'] ?? null,
                'department'            => $validated['department'] ?? null,
                'contact_no'            => $validated['contact_no'] ?? null,
                'grade_level'           => $validated['grade_level'] ?? null,
                'section'               => $validated['section'] ?? null,
                'guardian_relationship' => $validated['guardian_relationship'] ?? null,
                'address'               => $validated['address'] ?? null,
                'terms_accepted_at'     => now(),
            ]);

            // Not mass-assignable: set one by one. Public registration only ever gets a patient role
            // (the request is validated to student / faculty_staff above), active, no forced password change.
            $user->role_id              = $roleId;
            $user->role                 = $roleSlug;
            $user->is_active            = true;
            $user->must_change_password = false;
            $user->has_medical_access   = false;
            $user->save();

            $patientData = [
                'date_of_birth' => $validated['date_of_birth'],
                'gender'        => $validated['sex'],
                'age'           => $age,
            ];

            if ($validated['role'] === 'student') {
                $patientData += [
                    'guardian_name'         => $validated['guardian_name'] ?? null,
                    'guardian_relationship' => $validated['guardian_relationship'] ?? null,
                    'guardian_contact'      => $validated['guardian_contact'] ?? null,
                ];
            }

            $user->patient()->create($patientData);

            return $user;
        });

        AuditLogger::log(
            'registered',
            User::class,
            $user->id,
            null,
            ['name' => $user->name, 'email' => $user->email, 'role' => $user->role_slug]
        );

        // Notify admins about the new user registration
        try {
            $admins = User::where(function($q) {
                $q->where('role', 'admin')->orWhereHas('roleRelation', fn($rq) => $rq->where('slug', 'admin'));
            })->where('is_active', true)->get();
            $roleLabel = $user->role_slug === 'student' ? 'Student' : 'Faculty / Staff';
            foreach ($admins as $admin) {
                Notification::create([
                    'user_id'     => $admin->id,
                    'title'       => 'New User Registered',
                    'message'     => "New {$roleLabel} account registered: {$user->name} ({$user->email}).",
                    'type'        => 'info',
                    'target_type' => 'user',
                    'target_id'   => $user->id,
                    'action_url'  => '/admin/users',
                    'is_read'     => false,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('Failed to notify admins of user registration: ' . $e->getMessage());
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        $user->load(['patient', 'roleRelation']);
        $userPayload = $user->toArray();
        $userPayload['name'] = $user->name;
        $userPayload['role'] = $user->role_slug;
        $userPayload['role_id'] = $user->role_id;
        $userPayload['role_name'] = $user->role_name;
        $userPayload['patient'] = $user->patient;

        return response()->json([
            'message' => 'Registration successful.',
            'user'    => $userPayload,
            'token'   => $token,
        ], 201);
    }


    /**
     * Login and return a Sanctum token.
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $loginInput = trim($request->input('email'));

        $user = User::with('roleRelation')
            ->where('email', $loginInput)
            ->orWhere('email', strtolower($loginInput))
            ->orWhere('student_id', $loginInput)
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->is_active) {
            return response()->json(['message' => 'Your account has been deactivated. Please contact the administrator.'], 403);
        }

        // Revoke previous tokens (single-session)
        $user->tokens()->delete();

        $token = $user->createToken('auth_token')->plainTextToken;

        if ($user->isClinicStaff() || $user->isDentist()) {
            $user->update(['last_active_at' => now()]);
        }

        AuditLogger::log(
            'login',
            User::class,
            $user->id
        );

        $user->load(['patient', 'roleRelation']);
        $userPayload = $user->toArray();
        $userPayload['name'] = $user->name;
        $userPayload['role'] = $user->role_slug;
        $userPayload['role_id'] = $user->role_id;
        $userPayload['role_name'] = $user->role_name;
        $userPayload['patient'] = $user->patient;

        return response()->json([
            'message' => 'Login successful.',
            'user'    => $userPayload,
            'token'   => $token,
        ]);
    }

    /**
     * Logout (revoke current token).
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user) {
            $user->update(['last_active_at' => null]);
        }

        AuditLogger::log(
            'logout',
            User::class,
            $user->id
        );

        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    /**
     * Return the currently authenticated user with patient profile and role.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['patient', 'roleRelation']);
        $userData = $user->toArray();
        $userData['name'] = $user->name;
        $userData['role'] = $user->role_slug;
        $userData['role_id'] = $user->role_id;
        $userData['role_name'] = $user->role_name;
        $userData['patient'] = $user->patient;

        return response()->json([
            'user' => $userData,
        ]);
    }

    /**
     * Get authenticated user profile and patient details with readiness calculation.
     */
    public function getProfile(Request $request): JsonResponse
    {
        $user = $request->user()->load(['patient', 'roleRelation']);
        $userData = $user->toArray();
        $userData['name'] = $user->name;
        $userData['role'] = $user->role_slug;
        $userData['role_id'] = $user->role_id;
        $userData['role_name'] = $user->role_name;
        $userData['patient'] = $user->patient;

        $readiness = ProfileReadiness::for($user);

        return response()->json([
            'user'           => $userData,
            'patient'        => $user->patient,
            'readiness'      => $readiness['percent'],
            'missing_fields' => $readiness['missing'],
        ]);
    }

    /**
     * Calculate Clinic Record Readiness (share of required fields filled).
     * Delegates to the shared ProfileReadiness source of truth.
     */
    public function calculateReadiness(User $user): int
    {
        return ProfileReadiness::percent($user);
    }

    /**
     * Update authenticated user profile details (Student & Patient info).
     */
    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        // NOTE: the profile photo is NOT accepted here. It is uploaded as a file
        // through POST /api/profile/photo, and only its path is stored.
        $validated = $request->validate([
            // User identification & Name fields
            'name'                  => ['nullable', 'string', 'max:255', ...NameRules::person()],
            'first_name'            => ['nullable', 'string', 'max:100', ...NameRules::person()],
            'middle_name'           => ['nullable', 'string', 'max:100', ...NameRules::person()],
            'last_name'             => ['nullable', 'string', 'max:100', ...NameRules::person()],
            'suffix'                => ['nullable', 'string', 'max:50', ...NameRules::suffix()],
            'email'                 => ['nullable', 'string', 'email', 'max:255'],
            'current_password'      => ['nullable', 'string'],
            'student_id'            => ['nullable', 'string', 'max:50', \Illuminate\Validation\Rule::unique('users', 'student_id')->ignore($user->id)],
            'license_no'            => ['nullable', 'string', 'max:100'],
            'grade_level'           => ['nullable', 'string', 'max:50'],
            'section'               => ['nullable', 'string', 'max:100'],
            'school_year'           => ['nullable', 'string', 'max:50'],
            // Own number: valid PH mobile, unique (a number the user already has is never re-checked)
            'contact_no'            => ['nullable', 'string', ...PhilippineMobile::ownNumber($user->id, $request->input('contact_no'))],
            'address'               => ['nullable', 'string', 'max:500'],
            'age'                   => ['nullable', 'integer', 'min:1', 'max:120'],
            'department'            => ['nullable', 'string', 'max:255'],
            'sex'                   => ['nullable', 'string', 'in:male,female'],

            // Patient / Health Details
            'date_of_birth'         => ['nullable', 'date', 'before_or_equal:today'],
            'gender'                => ['nullable', 'string', 'in:male,female,other'],
            'blood_type'            => ['nullable', 'string', 'max:10'],
            'allergies'             => ['nullable', 'string', 'max:1000'],
            'current_medications'   => ['nullable', 'string', 'max:1000'],
            'medical_conditions'    => ['nullable', 'string', 'max:1000'],
            'medical_history'       => ['nullable', 'string', 'max:2000'],
            'other_health_notes'    => ['nullable', 'string', 'max:2000'],

            // Parent / Guardian
            'guardian_name'         => ['nullable', 'string', 'max:255'],
            'guardian_relationship' => ['nullable', 'string', 'max:100'],
            'guardian_contact'      => ['nullable', 'string', new PhilippineMobile()],
            'guardian_email'        => ['nullable', 'string', 'max:255'],

            // Emergency Contact
            'emergency_name'        => ['nullable', 'string', 'max:255'],
            'emergency_relationship'=> ['nullable', 'string', 'max:100'],
            'emergency_contact_no'  => ['nullable', 'string', new PhilippineMobile()],
            'emergency_alt_contact' => ['nullable', 'string', new PhilippineMobile()],
        ], NameRules::messages(['name', 'first_name', 'middle_name', 'last_name']) + [
            'student_id.unique'            => 'This ID is already used by another account.',
            'student_id.max'               => 'The ID must not be longer than 50 characters.',
            'license_no.max'               => 'The PRC license number must not be longer than 100 characters.',
            'contact_no.unique'            => PhilippineMobile::UNIQUE_MESSAGE,
            'date_of_birth.date'           => 'Please enter a valid date of birth.',
            'date_of_birth.before_or_equal'=> 'Date of birth cannot be in the future.',
            'sex.in'                       => 'Please select Male or Female.',
            'email.email'                  => 'Please enter a valid email address.',
            'first_name.max'               => 'First name must not be longer than 100 characters.',
            'last_name.max'                => 'Last name must not be longer than 100 characters.',
        ]);

        $oldUserValues = $user->toArray();

        // 1. Email change validation & handling
        if ($request->filled('email')) {
            $newEmail = strtolower(trim($request->input('email')));
            if ($newEmail !== strtolower($user->email)) {
                // Must end with @urios.edu.ph
                if (!preg_match('/^[A-Za-z0-9._%+-]+@urios\.edu\.ph$/i', $newEmail)) {
                    throw ValidationException::withMessages([
                        'email' => ['The email address must belong to the @urios.edu.ph domain (e.g. name@urios.edu.ph).'],
                    ]);
                }

                // Check uniqueness across users table
                $exists = User::where('email', $newEmail)->where('id', '!=', $user->id)->exists();
                if ($exists) {
                    throw ValidationException::withMessages([
                        'email' => ['This email address is already in use by another account.'],
                    ]);
                }

                // Current password confirmation is required
                $currentPassword = $request->input('current_password');
                if (!$currentPassword) {
                    throw ValidationException::withMessages([
                        'current_password' => ['Your current password is required to confirm changing your email address.'],
                    ]);
                }

                if (!Hash::check($currentPassword, $user->password)) {
                    throw ValidationException::withMessages([
                        'current_password' => ['The current password provided is incorrect.'],
                    ]);
                }

                $user->email = $newEmail;
            }
        }

        // 2. Name compilation (First, Middle, Last, Suffix)
        $firstName  = array_key_exists('first_name', $validated) ? trim($validated['first_name'] ?? '') : $user->first_name;
        $middleName = array_key_exists('middle_name', $validated) ? (trim($validated['middle_name'] ?? '') ?: null) : $user->middle_name;
        $lastName   = array_key_exists('last_name', $validated) ? trim($validated['last_name'] ?? '') : $user->last_name;
        $suffix     = array_key_exists('suffix', $validated) ? (trim($validated['suffix'] ?? '') ?: null) : $user->suffix;

        if ($firstName || $lastName) {
            $parts = array_filter([$firstName, $middleName, $lastName, $suffix], fn($p) => !is_null($p) && trim($p) !== '');
            $fullName = implode(' ', $parts);
        } else {
            $fullName = $validated['name'] ?? $user->name;
        }

        // If DOB provided, auto-compute age
        $computedAge = null;
        $dobValue = $validated['date_of_birth'] ?? null;
        if ($dobValue) {
            $computedAge = \Carbon\Carbon::parse($dobValue)->age;
        }

        // 3. Update User Model
        $userUpdateData = [
            'name'          => $fullName,
            'first_name'    => $firstName,
            'middle_name'   => $middleName,
            'last_name'     => $lastName,
            'suffix'        => $suffix,
            'student_id'    => array_key_exists('student_id', $validated) ? $validated['student_id'] : $user->student_id,
            'grade_level'   => array_key_exists('grade_level', $validated) ? $validated['grade_level'] : $user->grade_level,
            'section'       => array_key_exists('section', $validated) ? $validated['section'] : $user->section,
            'school_year'   => array_key_exists('school_year', $validated) ? $validated['school_year'] : $user->school_year,
            'contact_no'    => array_key_exists('contact_no', $validated) ? $validated['contact_no'] : $user->contact_no,
            'address'       => array_key_exists('address', $validated) ? $validated['address'] : $user->address,
            'department'    => array_key_exists('department', $validated) ? $validated['department'] : $user->department,
            'sex'           => array_key_exists('sex', $validated) ? $validated['sex'] : $user->sex,
        ];

        // PRC license number is only meaningful for nurses / dentists.
        if (array_key_exists('license_no', $validated) && ($user->isClinicStaff() || $user->isDentist())) {
            $userUpdateData['license_no'] = $validated['license_no'] !== null && trim($validated['license_no']) !== ''
                ? trim($validated['license_no'])
                : null;
        }

        if ($dobValue !== null) {
            $userUpdateData['date_of_birth'] = $dobValue;
        } elseif (array_key_exists('date_of_birth', $validated)) {
            $userUpdateData['date_of_birth'] = $validated['date_of_birth'];
        }

        if ($computedAge !== null) {
            $userUpdateData['age'] = $computedAge;
        } elseif (array_key_exists('age', $validated)) {
            $userUpdateData['age'] = $validated['age'];
        }

        $user->update($userUpdateData);

        // 4. Update or Create Patient Model (students, faculty/staff, or existing patients)
        $patient = $user->patient;
        $isStudentOrPatient = in_array($user->role_slug, ['student', 'faculty_staff'])
            || in_array($user->attributes['role'] ?? '', ['student', 'faculty_staff'])
            || $patient !== null;

        if ($isStudentOrPatient) {
            $patientData = [
                'blood_type'            => array_key_exists('blood_type', $validated) ? $validated['blood_type'] : $patient?->blood_type,
                'allergies'             => array_key_exists('allergies', $validated) ? $validated['allergies'] : $patient?->allergies,
                'current_medications'   => array_key_exists('current_medications', $validated) ? $validated['current_medications'] : $patient?->current_medications,
                'medical_conditions'    => array_key_exists('medical_conditions', $validated) ? $validated['medical_conditions'] : $patient?->medical_conditions,
                'medical_history'       => array_key_exists('medical_history', $validated) ? $validated['medical_history'] : $patient?->medical_history,
                'other_health_notes'    => array_key_exists('other_health_notes', $validated) ? $validated['other_health_notes'] : $patient?->other_health_notes,
                'guardian_name'         => array_key_exists('guardian_name', $validated) ? $validated['guardian_name'] : $patient?->guardian_name,
                'guardian_relationship' => array_key_exists('guardian_relationship', $validated) ? $validated['guardian_relationship'] : $patient?->guardian_relationship,
                'guardian_contact'      => array_key_exists('guardian_contact', $validated) ? $validated['guardian_contact'] : $patient?->guardian_contact,
                'guardian_email'        => array_key_exists('guardian_email', $validated) ? $validated['guardian_email'] : $patient?->guardian_email,
                'emergency_name'        => array_key_exists('emergency_name', $validated) ? $validated['emergency_name'] : $patient?->emergency_name,
                'emergency_relationship'=> array_key_exists('emergency_relationship', $validated) ? $validated['emergency_relationship'] : $patient?->emergency_relationship,
                'emergency_contact_no'  => array_key_exists('emergency_contact_no', $validated) ? $validated['emergency_contact_no'] : $patient?->emergency_contact_no,
                'emergency_alt_contact' => array_key_exists('emergency_alt_contact', $validated) ? $validated['emergency_alt_contact'] : $patient?->emergency_alt_contact,
            ];

            if (array_key_exists('emergency_contact_no', $validated)) {
                $patientData['emergency_contact'] = $validated['emergency_contact_no'];
            } elseif ($patient) {
                $patientData['emergency_contact'] = $patient->emergency_contact;
            }

            if (array_key_exists('gender', $validated)) {
                $patientData['gender'] = $validated['gender'];
            } elseif (array_key_exists('sex', $validated)) {
                $patientData['gender'] = $validated['sex'];
            } elseif ($patient) {
                $patientData['gender'] = $patient->gender;
            }

            if ($dobValue !== null) {
                $patientData['date_of_birth'] = $dobValue;
            } elseif (array_key_exists('date_of_birth', $validated)) {
                $patientData['date_of_birth'] = $validated['date_of_birth'];
            }

            if ($computedAge !== null) {
                $patientData['age'] = $computedAge;
            } elseif (array_key_exists('age', $validated)) {
                $patientData['age'] = $validated['age'];
            }

            if ($patient) {
                $patient->update($patientData);
            } else {
                $patient = $user->patient()->create($patientData);
            }
        }

        // 5. Log changes to Audit Logs
        AuditLogger::log(
            'profile_updated',
            User::class,
            $user->id,
            $oldUserValues,
            $user->getChanges()
        );

        $user->refresh();
        $user->load(['patient', 'roleRelation']);
        $userPayload = $user->toArray();
        $userPayload['name'] = $user->name;
        $userPayload['role'] = $user->role_slug;
        $userPayload['role_id'] = $user->role_id;
        $userPayload['role_name'] = $user->role_name;
        $userPayload['patient'] = $user->patient;

        $readiness = $this->calculateReadiness($user);

        return response()->json([
            'message'   => 'Profile updated successfully.',
            'user'      => $userPayload,
            'patient'   => $user->patient,
            'readiness' => $readiness,
        ]);
    }

    /**
     * Change authenticated user password.
     */
    public function changePassword(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            // Google-created accounts have a random unusable password: they are already
            // signed in, so they may set their first password without the current one.
            'current_password'      => [$user->google_id ? 'nullable' : 'required', 'string'],
            'password'              => ['required', 'confirmed', Password::min(8)],
        ]);

        if (! $user->google_id || $request->filled('current_password')) {
            if (! Hash::check($validated['current_password'] ?? '', $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['The current password provided is incorrect.'],
                ]);
            }
        }

        $user->password             = Hash::make($validated['password']);
        $user->must_change_password = false;   // not mass-assignable, set explicitly
        $user->save();

        // A new password signs out every other session (a stolen token stops working). The token
        // making this request is kept, so the user stays signed in on this device.
        $current = $user->currentAccessToken();
        $user->tokens()
            ->when($current instanceof PersonalAccessToken, fn ($q) => $q->where('id', '!=', $current->id))
            ->delete();

        AuditLogger::log(
            'password_changed',
            User::class,
            $user->id
        );

        return response()->json([
            'message' => 'Password has been updated successfully.',
        ]);
    }
}

