<?php

namespace App\Support;

use App\Models\Appointment;
use App\Models\Patient;
use App\Models\User;

/**
 * Single source of truth for "Clinic Record Readiness".
 * Used by the profile endpoint, appointment booking and walk-in consultation checks.
 */
class ProfileReadiness
{
    /** field key => human label, in display order */
    private const FIELDS = [
        'first_name'           => 'First name',
        'last_name'            => 'Last name',
        'student_id'           => 'Student/ID number',
        'grade_level'          => 'Grade level',
        'section'              => 'Section',
        'date_of_birth'        => 'Date of birth',
        'sex'                  => 'Sex',
        'contact_no'           => 'Contact number',
        'address'              => 'Address',
        'guardian_name'        => 'Guardian name',
        'guardian_contact'     => 'Guardian contact',
        'emergency_name'       => 'Emergency contact name',
        'emergency_contact_no' => 'Emergency contact number',
        'blood_type'           => 'Blood type',
        'allergies'            => 'Allergies',
        'medical_history'      => 'Medical history',
    ];

    /**
     * @return array{percent:int, missing:string[]}
     */
    public static function for(User $user): array
    {
        $user->loadMissing('patient');
        $patient = $user->patient;

        $values = [
            'first_name'           => $user->first_name,
            'last_name'            => $user->last_name,
            'student_id'           => $user->student_id,
            'grade_level'          => $user->grade_level,
            'section'              => $user->section,
            'date_of_birth'        => $user->date_of_birth ?: $patient?->date_of_birth,
            'sex'                  => $user->sex ?: $patient?->gender,
            'contact_no'           => $user->contact_no,
            'address'              => $user->address,
            'guardian_name'        => $patient?->guardian_name,
            'guardian_contact'     => $patient?->guardian_contact,
            'emergency_name'       => $patient?->emergency_name,
            'emergency_contact_no' => $patient?->emergency_contact_no ?: $patient?->emergency_contact,
            'blood_type'           => $patient?->blood_type,
            'allergies'            => $patient?->allergies,
            'medical_history'      => $patient?->medical_history,
        ];

        $missing = [];
        foreach (self::FIELDS as $key => $label) {
            $val = $values[$key] ?? null;
            if ($val === null || trim((string) $val) === '') {
                $missing[] = $label;
            }
        }

        $percent = (int) round(((count(self::FIELDS) - count($missing)) / count(self::FIELDS)) * 100);

        return ['percent' => $percent, 'missing' => $missing];
    }

    /** Convenience: percent only (kept for callers that only need the number). */
    public static function percent(User $user): int
    {
        return self::for($user)['percent'];
    }

    /**
     * Walk-in gate for consultations. Returns null when the consultation may proceed:
     * either the patient has a confirmed appointment, or their readiness is 100%.
     * Otherwise returns ['percent'=>int,'missing'=>string[]].
     */
    public static function walkInBlocker(?Patient $patient, ?int $appointmentId): ?array
    {
        if ($appointmentId) {
            $appointment = Appointment::find($appointmentId);
            if ($appointment && $appointment->status === 'confirmed') {
                return null;
            }
        }

        $user = $patient?->user;
        if (! $user) {
            return null;
        }

        $readiness = self::for($user);
        return $readiness['percent'] < 100 ? $readiness : null;
    }
}
