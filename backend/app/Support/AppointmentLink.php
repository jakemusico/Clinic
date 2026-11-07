<?php

namespace App\Support;

use App\Models\Appointment;
use Illuminate\Validation\ValidationException;

/**
 * Links a consultation (medical or dental) to the appointment it was held for.
 *
 * One appointment can have at most ONE consultation. claim() must run inside the DB::transaction
 * that saves the consultation: it locks the appointment row, so a double click or a retry waits
 * for the first save and then finds the appointment already taken. (The unique index on
 * appointment_id is the database-level backstop for the same rule.)
 */
final class AppointmentLink
{
    /**
     * Lock the appointment and make sure the consultation may be linked to it.
     *
     * @param  class-string  $consultationModel  ClinicRecord::class or DentalConsultation::class
     * @param  int|null      $ignoreRecordId     the consultation being edited (it may keep its own appointment)
     * @param  bool          $requireOpen        true when creating or re-linking: the appointment must still be pending/confirmed
     *
     * @throws ValidationException (422, field `appointment_id`)
     */
    public static function claim(
        ?int $appointmentId,
        int $patientId,
        string $consultationModel,
        ?int $ignoreRecordId = null,
        bool $requireOpen = true
    ): ?Appointment {
        if (! $appointmentId) {
            return null;
        }

        $appointment = Appointment::whereKey($appointmentId)->lockForUpdate()->first();

        if (! $appointment) {
            self::fail('That appointment no longer exists.');
        }

        if ((int) $appointment->patient_id !== $patientId) {
            self::fail('That appointment belongs to a different patient.');
        }

        $taken = $consultationModel::where('appointment_id', $appointmentId)
            ->when($ignoreRecordId, fn ($q) => $q->where('id', '!=', $ignoreRecordId))
            ->lockForUpdate()
            ->first(['id']);

        if ($taken) {
            self::fail('That appointment already has a consultation record.');
        }

        if ($requireOpen && ! in_array($appointment->status, ['pending', 'confirmed'], true)) {
            self::fail("That appointment is {$appointment->status} and cannot be linked to a new consultation.");
        }

        return $appointment;
    }

    private static function fail(string $message): never
    {
        throw ValidationException::withMessages(['appointment_id' => [$message]]);
    }
}
