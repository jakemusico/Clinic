<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Proxies are NOT trusted by default. Only the addresses in TRUSTED_PROXIES (config/trustedproxy.php)
        // may supply X-Forwarded-For / -Host / -Proto, so the audit log's IP cannot be faked.

        // CORS for SPA: allow credentials from the frontend origin
        $middleware->statefulApi();

        // Every phone number in an API request is converted to 09XXXXXXXXX before validation
        $middleware->api(append: [
            \App\Http\Middleware\NormalizePhoneNumbers::class,
        ]);

        // Register custom role middleware alias
        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureRole::class,
            // Rejects (and signs out) requests from deactivated accounts
            'active' => \App\Http\Middleware\EnsureUserIsActive::class,
            // Blocks everything except change-password and logout while must_change_password is set
            'password.changed' => \App\Http\Middleware\EnsurePasswordIsChanged::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Uploads larger than PHP's post_max_size never reach validation.
        $exceptions->render(function (\Illuminate\Http\Exceptions\PostTooLargeException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'The file you selected is too large. Please choose a smaller file (photos must be under 2MB).',
                ], 413);
            }
        });

        // Never expose raw SQL or server errors to API clients.
        // Laravel has already logged the full exception (with SQL and stack trace)
        // to storage/logs/laravel.log before this runs; only a friendly message is returned.
        $exceptions->respond(function (\Symfony\Component\HttpFoundation\Response $response, \Throwable $e, \Illuminate\Http\Request $request) {
            if (! $request->is('api/*')) {
                return $response;
            }

            // 4xx: keep Laravel's message/errors, but drop debug internals
            // (exception class, file paths, stack trace) that APP_DEBUG adds.
            if ($response->getStatusCode() < 500) {
                if ($response instanceof \Illuminate\Http\JsonResponse) {
                    $data = $response->getData(true);
                    if (is_array($data) && (isset($data['trace']) || isset($data['exception']) || isset($data['file']))) {
                        unset($data['trace'], $data['exception'], $data['file'], $data['line']);
                        $response->setData($data);
                    }
                }

                return $response;
            }

            if ($e instanceof \Illuminate\Database\QueryException) {
                // SQLSTATE 23000 = integrity constraint (duplicate / foreign key).
                if ((string) $e->getCode() === '23000') {
                    return response()->json([
                        'message' => 'This information conflicts with an existing record. Please check your entries and try again.',
                    ], 409);
                }

                return response()->json([
                    'message' => 'We could not save your changes because of a database problem. Please try again in a moment.',
                ], 500);
            }

            return response()->json([
                'message' => 'Something went wrong on our side. Please try again in a moment.',
            ], $response->getStatusCode());
        });
    })->create();
