<?php

namespace App\Support;

/**
 * The one definition of a phone number in this app.
 *
 * Stored format (canonical): 09XXXXXXXXX, 11 digits, a Philippine mobile number.
 * Accepted as input: 09XXXXXXXXX, +639XXXXXXXXX and 639XXXXXXXXX, with spaces, dashes, dots or
 * brackets anywhere (0917-123-4567, +63 917 123 4567, ...). They are all converted to 09XXXXXXXXX.
 *
 * Used by: the request middleware (NormalizePhoneNumbers), the validation rule
 * (App\Rules\PhilippineMobile), the User and Patient model mutators, and the data-fix migration.
 */
final class PhoneNumber
{
    /** Every request/model field that holds a phone number. */
    public const FIELDS = [
        'contact_no',            // users.contact_no: the user's own number (may be shared within a family)
        'guardian_contact',      // patients.guardian_contact
        'emergency_contact_no',  // patients.emergency_contact_no
        'emergency_alt_contact', // patients.emergency_alt_contact
        'emergency_contact',     // patients.emergency_contact (older column, kept in step with emergency_contact_no)
    ];

    /** The canonical form: 09 followed by 9 digits. */
    private const CANONICAL = '/^09\d{9}$/';

    /**
     * The canonical number (09XXXXXXXXX), or null when the value is empty or is not a valid
     * Philippine mobile number in one of the three accepted formats.
     */
    public static function normalize(mixed $value): ?string
    {
        if (! is_string($value) && ! is_int($value)) {
            return null;
        }

        // Spaces, dashes, dots and brackets are only for readability
        $compact = preg_replace('/[\s\-.()]+/', '', trim((string) $value));

        if ($compact === null || $compact === '') {
            return null;
        }

        // +639XXXXXXXXX or 639XXXXXXXXX -> 09XXXXXXXXX
        if (preg_match('/^\+?63(9\d{9})$/', $compact, $m)) {
            return '0' . $m[1];
        }

        return preg_match(self::CANONICAL, $compact) === 1 ? $compact : null;
    }

    /** True for null, '' and whitespace: a phone field the user left empty. */
    public static function isBlank(mixed $value): bool
    {
        return $value === null || (is_string($value) && trim($value) === '');
    }

    /** True when the value is already stored in the canonical form. */
    public static function isCanonical(mixed $value): bool
    {
        return is_string($value) && preg_match(self::CANONICAL, $value) === 1;
    }

    /**
     * What to put in a request/attribute for this value:
     *   empty            -> null
     *   a valid number   -> the canonical 09XXXXXXXXX
     *   anything else    -> the trimmed text unchanged, so validation can reject it with a message
     *                       (and so a model never silently throws away what it was given).
     */
    public static function clean(mixed $value): mixed
    {
        if (self::isBlank($value)) {
            return null;
        }

        $normalized = self::normalize($value);

        if ($normalized !== null) {
            return $normalized;
        }

        return is_string($value) ? trim($value) : $value;
    }
}
