<?php

namespace App\Http\Middleware;

use App\Support\Roles;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    /**
     * Handle an incoming request.
     * Usage: ->middleware('role:admin,clinic_staff')
     *
     * An allow-list: the user's normalised role (see App\Support\Roles, so nurse = clinic_staff)
     * must be one of the listed roles.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! Roles::is($user, ...$roles)) {
            return response()->json([
                'message'        => 'Forbidden. You do not have permission to access this resource.',
                'required_roles' => $roles,
                'your_role'      => Roles::of($user),
            ], 403);
        }

        return $next($request);
    }
}
