<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Rejects every authenticated request from a deactivated account.
 *
 * Login already refuses inactive users, but a token issued before the account was deactivated
 * would otherwise keep working. Deactivating a user also deletes their tokens
 * (UserController::toggleStatus); this check is the safety net, for example when the flag is
 * changed directly in the database.
 *
 * Responds 401 so the SPA's response interceptor clears the session and returns to the login page.
 */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->is_active) {
            $token = $user->currentAccessToken();
            if ($token instanceof PersonalAccessToken) {
                $token->delete();
            }

            return response()->json([
                'message' => 'Your account has been deactivated. Please contact the administrator.',
            ], 401);
        }

        return $next($request);
    }
}
