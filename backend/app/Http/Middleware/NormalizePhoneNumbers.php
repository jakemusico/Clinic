<?php

namespace App\Http\Middleware;

use App\Support\PhoneNumber;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Converts every phone number in the request to the stored format (09XXXXXXXXX) BEFORE validation,
 * so the rules see (and the database gets) one format whatever the user typed:
 * 0917-123-4567, +63 917 123 4567, 639171234567 ... all become 09171234567.
 *
 * A value that is not a valid number is left as typed, so the PhilippineMobile rule can reject it
 * with a message. Empty values become null. This runs for every API route (see bootstrap/app.php),
 * so a new endpoint that uses one of the PhoneNumber::FIELDS names is covered without extra work.
 * It does the job of a FormRequest's prepareForValidation(); the controllers here validate inline.
 */
class NormalizePhoneNumbers
{
    public function handle(Request $request, Closure $next): Response
    {
        $clean = [];

        foreach (PhoneNumber::FIELDS as $field) {
            if ($request->exists($field)) {
                $clean[$field] = PhoneNumber::clean($request->input($field));
            }
        }

        if ($clean) {
            $request->merge($clean);
        }

        return $next($request);
    }
}
