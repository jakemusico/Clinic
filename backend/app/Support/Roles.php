<?php

namespace App\Support;

use App\Models\User;

/**
 * The ONE place that decides what role a user has and what each role may do.
 *
 * Role names are normalised from `role_slug` (see User::getRoleSlugAttribute), so the nurse/clinic_staff
 * and faculty/faculty_staff aliases mean the same thing everywhere. Every check here is an allow-list:
 * a user whose role is missing, unknown or not named in the list is refused.
 *
 *   nurse (clinic_staff)  -> MEDICAL records, appointments, dispensing and reports only
 *   dentist               -> DENTAL records, appointments, dispensing and reports only
 *   admin                 -> both
 *   student / faculty     -> their own data only
 */
final class Roles
{
    public const ADMIN   = 'admin';
    public const NURSE   = 'clinic_staff';
    public const DENTIST = 'dentist';
    public const STUDENT = 'student';
    public const FACULTY = 'faculty_staff';

    public const MEDICAL = 'medical';
    public const DENTAL  = 'dental';

    /** Alternative spellings that are stored or sent in some places => the canonical slug. */
    private const ALIASES = [
        'nurse'   => self::NURSE,
        'faculty' => self::FACULTY,
    ];

    /** Roles that work in the clinic. */
    public const CLINIC_STAFF = [self::NURSE, self::DENTIST, self::ADMIN];

    /** Roles that are patients and may only see their own data. */
    public const PATIENTS = [self::STUDENT, self::FACULTY];

    /** Canonical role slug of a user (or of a raw slug), or null when there is none. */
    public static function of(User|string|null $who): ?string
    {
        $slug = $who instanceof User ? $who->role_slug : $who;

        if (! is_string($slug) || trim($slug) === '') {
            return null;
        }

        $slug = strtolower(trim($slug));

        return self::ALIASES[$slug] ?? $slug;
    }

    /** True when the user's role is one of $roles (allow-list). Aliases are accepted on both sides. */
    public static function is(User|string|null $who, string ...$roles): bool
    {
        $role = self::of($who);

        if ($role === null) {
            return false;
        }

        foreach ($roles as $allowed) {
            if (self::of($allowed) === $role) {
                return true;
            }
        }

        return false;
    }

    public static function isAdmin(?User $user): bool
    {
        return self::is($user, self::ADMIN);
    }

    public static function isPatient(?User $user): bool
    {
        return self::is($user, ...self::PATIENTS);
    }

    public static function isClinicStaff(?User $user): bool
    {
        return self::is($user, ...self::CLINIC_STAFF);
    }

    /**
     * The kinds of care a user may see and manage: ['medical'], ['dental'], both for admin,
     * and none for everybody else (patients get their own data through their own checks).
     *
     * @return string[]
     */
    public static function careTypes(?User $user): array
    {
        return match (self::of($user)) {
            self::NURSE   => [self::MEDICAL],
            self::DENTIST => [self::DENTAL],
            self::ADMIN   => [self::MEDICAL, self::DENTAL],
            default       => [],
        };
    }

    /** May this user see/manage records of this kind of care ('medical' or 'dental')? */
    public static function canAccessCare(?User $user, ?string $careType): bool
    {
        return $careType !== null && in_array($careType, self::careTypes($user), true);
    }

    /**
     * Narrow a query on a column holding the kind of care to what the user may see.
     * Admin sees both; patients and unknown roles see nothing.
     *
     * @param  \Illuminate\Database\Eloquent\Builder|\Illuminate\Database\Query\Builder  $query
     */
    public static function limitToCare($query, ?User $user, string $column, bool $includeNull = false)
    {
        $types = self::careTypes($user);

        return $query->where(function ($q) use ($types, $column, $includeNull) {
            $q->whereIn($column, $types);
            if ($includeNull) {
                $q->orWhereNull($column);
            }
        });
    }
}
