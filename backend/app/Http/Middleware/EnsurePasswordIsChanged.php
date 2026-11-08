<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Accounts created or reset by an admin must choose their own password first.
 *
 * Until they do, the API refuses every request except changing the password and logging out. This is
 * enforced here on the server, so skipping the "change password" screen in the browser gets nowhere.
 */
class EnsurePasswordIsChanged
{
    /** The only endpoints a user with `must_change_password` may call (the "api/" prefix is part of the path). */
    private const ALLOWED = [
        'api/auth/change-password',
        'api/auth/logout',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->must_change_password && ! $request->is(...self::ALLOWED)) {
            return response()->json([
                'message' => 'You must change your password before you can continue.',
                'code'    => 'password_change_required',
            ], 403);
        }

        return $next($request);
    }
}
