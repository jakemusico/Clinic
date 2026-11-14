<?php

namespace App\Rules;

use App\Support\PhoneNumber;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * A Philippine mobile number: 09XXXXXXXXX, +639XXXXXXXXX or 639XXXXXXXXX (spaces and dashes allowed).
 * An empty value passes: combine with 'required' when the field is mandatory.
 *
 * Numbers are NOT unique: siblings and family members may share one phone number
 * (users.contact_no, patients guardian/emergency numbers).
 *
 * The NormalizePhoneNumbers middleware has already converted valid numbers to 09XXXXXXXXX by the time
 * this runs, so what gets stored is always the canonical form.
 */
class PhilippineMobile implements ValidationRule
{
    public const MESSAGE = 'Enter a valid Philippine mobile number, like 09171234567 or +639171234567.';

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (PhoneNumber::isBlank($value)) {
            return;
        }

        if (PhoneNumber::normalize($value) === null) {
            $fail(self::MESSAGE);
        }
    }
}
