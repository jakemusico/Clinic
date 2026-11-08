<?php

namespace App\Rules;

use App\Models\User;
use App\Support\PhoneNumber;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * A Philippine mobile number: 09XXXXXXXXX, +639XXXXXXXXX or 639XXXXXXXXX (spaces and dashes allowed).
 * An empty value passes: combine with 'required' when the field is mandatory.
 *
 * The NormalizePhoneNumbers middleware has already converted valid numbers to 09XXXXXXXXX by the time
 * this runs, so what gets stored is always the canonical form.
 */
class PhilippineMobile implements ValidationRule
{
    public const MESSAGE = 'Enter a valid Philippine mobile number, like 09171234567 or +639171234567.';

    public const UNIQUE_MESSAGE = 'This mobile number is already used by another account.';

    /**
     * Rules for a user's OWN number (users.contact_no): a valid number, and not used by another user.
     * Guardian and emergency numbers are NOT unique (brothers and sisters share them): use `new PhilippineMobile`.
     *
     * When $ignoreUserId is given and the incoming number equals the one that user already has, the
     * uniqueness check is skipped. That way a user whose number was already shared before this rule
     * existed can still save their profile; only a CHANGE to a number someone else uses is refused.
     *
     * @return array<int, mixed>
     */
    public static function ownNumber(?int $ignoreUserId = null, mixed $incoming = null): array
    {
        $rules = [new self()];

        if ($ignoreUserId !== null) {
            $current  = User::whereKey($ignoreUserId)->value('contact_no');
            $incoming = PhoneNumber::normalize($incoming);

            if ($incoming !== null && PhoneNumber::normalize($current) === $incoming) {
                return $rules;
            }
        }

        $rules[] = Rule::unique('users', 'contact_no')->ignore($ignoreUserId);

        return $rules;
    }

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
