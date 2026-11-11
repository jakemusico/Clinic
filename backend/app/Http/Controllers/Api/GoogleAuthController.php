<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Socialite\Facades\Socialite;

/**
 * "Continue with Google" — restricted to verified @urios.edu.ph accounts.
 *
 * Flow: the SPA asks /auth/google/redirect for the Google URL, sends the browser there,
 * Google comes back to /auth/google/callback (stateless — no session needed), and we
 * either log the existing user in or stash the profile briefly so the sign-up page can
 * finish with a role choice.
 */
class GoogleAuthController extends Controller
{
    private const DOMAIN       = 'urios.edu.ph';
    private const PENDING_TTL  = 600; // seconds a pending sign-up stays valid
    private const ALLOWED_ROLES = ['student', 'faculty_staff'];

    /** GET /api/auth/google/redirect — returns the Google consent URL as JSON. */
    public function redirect(): JsonResponse
    {
        $url = Socialite::driver('google')
            ->stateless()
            ->with(['hd' => self::DOMAIN, 'prompt' => 'select_account'])
            ->redirect()
            ->getTargetUrl();

        return response()->json(['url' => $url]);
    }

    /** GET /api/auth/google/callback — Google sends the browser back here. */
    public function callback(): RedirectResponse
    {
        $frontend = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $fail = fn (string $reason) => redirect("{$frontend}/login?error={$reason}");

        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Throwable $e) {
            return $fail('google');
        }

        $raw    = $googleUser->user ?? [];
        $email  = strtolower(trim((string) $googleUser->getEmail()));
        $verified = $raw['email_verified'] ?? false;
        $verified = $verified === true || $verified === 'true' || $verified === 1 || $verified === '1';

        // Backend enforcement — the hd hint alone is not trusted.
        if (! str_ends_with($email, '@' . self::DOMAIN) || ! $verified) {
            AuditLogger::log('google_signin_rejected', User::class, null, null, ['email' => $email]);
            return $fail('domain');
        }

        $user = User::where('email', $email)->first();

        if ($user) {
            if (! $user->is_active) {
                return $fail('inactive');
            }

            // Link the Google identity only because the email matched exactly.
            if (! $user->google_id) {
                $user->google_id = (string) $googleUser->getId();
                if (! $user->avatar && $googleUser->getAvatar()) {
                    $user->avatar = $googleUser->getAvatar();
                }
                $user->save();
            }

            // Same single-session rule as password login.
            $user->tokens()->delete();
            $token = $user->createToken('auth_token')->plainTextToken;

            AuditLogger::log('google_login', User::class, $user->id, null, ['email' => $email]);

            return redirect("{$frontend}/auth/google?token={$token}&role=" . urlencode((string) $user->role_slug));
        }

        // No account yet: hand the verified profile to the sign-up page (role choice).
        $pending = Str::random(48);
        Cache::put("google_pending:{$pending}", [
            'sub'          => (string) $googleUser->getId(),
            'name'         => $googleUser->getName(),
            'given_name'   => $raw['given_name'] ?? null,
            'family_name'  => $raw['family_name'] ?? null,
            'email'        => $email,
            'avatar'       => $googleUser->getAvatar(),
        ], self::PENDING_TTL);

        return redirect("{$frontend}/auth/google?pending={$pending}");
    }

    /**
     * POST /api/auth/google/complete — finish a Google sign-up.
     * The role is chosen on screen and restricted to the two public roles;
     * it is never taken from the email or trusted beyond that list.
     */
    public function complete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pending' => ['required', 'string', 'size:48'],
            'role'    => ['required', 'string', Rule::in(self::ALLOWED_ROLES)],
        ]);

        $profile = Cache::pull("google_pending:{$validated['pending']}");

        if (! is_array($profile) || empty($profile['sub']) || empty($profile['email'])) {
            throw ValidationException::withMessages([
                'pending' => ['Your Google sign-up session expired. Please try again.'],
            ]);
        }

        // Defense in depth: the pending profile was verified at the callback, re-check anyway.
        if (! str_ends_with(strtolower($profile['email']), '@' . self::DOMAIN)) {
            throw ValidationException::withMessages([
                'pending' => ['Please use your @urios.edu.ph Google account.'],
            ]);
        }

        if (User::where('email', $profile['email'])->exists()) {
            throw ValidationException::withMessages([
                'email' => ['An account with this email already exists. Please sign in instead.'],
            ]);
        }

        [$firstName, $lastName] = $this->splitName($profile);

        $roleSlug = $validated['role'];
        $roleModel = Role::where('slug', $roleSlug)->first();
        $roleId = $roleModel?->id ?? ($roleSlug === 'student' ? 4 : 5);

        // The account and its patient profile are created together, like manual registration.
        // The password is random and unusable: Google accounts sign in with Google only
        // until the user sets a password themselves.
        $user = DB::transaction(function () use ($profile, $roleId, $roleSlug, $firstName, $lastName) {
            $user = new User([
                'first_name'        => $firstName,
                'last_name'         => $lastName,
                'email'             => $profile['email'],
                'password'          => Str::random(48), // hashed cast makes it unusable
                'avatar'            => $profile['avatar'] ?? null,
                'terms_accepted_at' => now(),
            ]);
            // Set one by one (not mass-assignable), same rule as role/is_active.
            $user->google_id         = $profile['sub'];
            $user->email_verified_at = now();
            $user->role_id              = $roleId;
            $user->role                 = $roleSlug;
            $user->is_active            = true;
            $user->must_change_password = false;
            $user->has_medical_access   = false;
            $user->save();

            // Google gives no DOB/sex yet — the profile stays incomplete and the 100%
            // readiness rule keeps applying until My Profile is finished.
            $user->patient()->create([]);

            return $user;
        });

        AuditLogger::log('google_signup', User::class, $user->id, null, [
            'name' => $user->name, 'email' => $user->email, 'role' => $user->role_slug,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Account created.',
            'user'    => $user->load(['patient', 'roleRelation'])->toApiArray(),
            'token'   => $token,
        ], 201);
    }

    /** given_name/family_name when Google sends them, else split the display name. */
    private function splitName(array $profile): array
    {
        $given  = trim((string) ($profile['given_name'] ?? ''));
        $family = trim((string) ($profile['family_name'] ?? ''));

        if ($given !== '' || $family !== '') {
            return [$given !== '' ? $given : 'Student', $family];
        }

        $parts = preg_split('/\s+/', trim((string) ($profile['name'] ?? ''))) ?: [];
        $first = array_shift($parts) ?: 'Student';
        $last  = trim(implode(' ', $parts));

        return [$first, $last !== '' ? $last : 'User'];
    }
}
