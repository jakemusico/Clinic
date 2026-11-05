<?php

namespace App\Services;

use App\Models\Appointment;
use Illuminate\Validation\Rule;

/**
 * The clinic service a consultation was for.
 *
 * Medical and dental consultations store the service name on the record itself
 * (clinic_records.service_name / dental_consultations.service_name), so the Service
 * column does not depend on an appointment being linked.
 *
 *  - Linked to an appointment: the service is the appointment's (the form locks it).
 *  - Not linked: the user must pick one, and it must be an active service of the right kind
 *    of care (nurse = medical, dentist = dental).
 */
class ConsultationServiceName
{
    /**
     * The appointment's service when one is linked, else the name the user picked, else null.
     */
    public static function resolve(?string $given, int|string|null $appointmentId = null): ?string
    {
        if ($appointmentId) {
            $name = Appointment::with('service')->find($appointmentId)?->service?->name;
            if ($name !== null && trim($name) !== '') {
                return trim($name);
            }
        }

        $given = trim((string) $given);

        return $given !== '' ? $given : null;
    }

    /**
     * Validation rules for `service_name`.
     *
     * @param  string  $careType  'medical' or 'dental'
     * @param  bool    $locked    the service comes from a linked appointment (not picked), so only its presence is checked
     * @param  bool    $required  false when editing a record and the service is not being changed
     */
    public static function rules(string $careType, bool $locked = false, bool $required = true): array
    {
        $rules = [$required ? 'required' : 'nullable', 'string', 'max:255'];

        if (! $locked) {
            $rules[] = Rule::exists('clinic_services', 'name')
                ->where('care_type', $careType)
                ->where('is_active', true);
        }

        return $rules;
    }
}
