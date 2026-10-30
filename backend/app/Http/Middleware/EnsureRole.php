<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    /**
     * Handle an incoming request.
     * Usage: ->middleware('role:admin,clinic_staff')
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $userRoleSlug = $user->role_slug ?? ($user->role instanceof \App\Models\Role ? $user->role->slug : $user->role);

        $allowed = false;
        foreach ($roles as $r) {
            if ($userRoleSlug === $r) {
                $allowed = true;
                break;
            }
            // Nurse and clinic_staff are aliases
            if ($userRoleSlug === 'nurse' && $r === 'clinic_staff') {
                $allowed = true;
                break;
            }
            if ($userRoleSlug === 'clinic_staff' && $r === 'nurse') {
                $allowed = true;
                break;
            }
        }

        if (! $allowed) {
            return response()->json([
                'message'        => 'Forbidden. You do not have permission to access this resource.',
                'required_roles' => $roles,
                'your_role'      => $userRoleSlug,
            ], 403);
        }

        return $next($request);
    }
}
