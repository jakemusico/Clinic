<?php

namespace App\Support;

use Closure;

/**
 * Validation for the optional vital signs on a consultation.
 * A value is checked only when it is filled in; an empty field is fine.
 */
final class VitalsRules
{
    /** Rules to merge into a consultation request's validate() call. */
    public static function rules(): array
    {
        return [
            'vitals'                => ['nullable', 'array'],
            'vitals.blood_pressure' => ['nullable', 'max:30', self::bloodPressure(...)],
            'vitals.bp'             => ['nullable', 'max:30'],   // older alias of blood_pressure
            'vitals.temperature'    => ['nullable', self::range(30, 45, 'Temperature must be between 30 and 45 °C.')],
            'vitals.pulse_rate'     => ['nullable', self::range(30, 250, 'Pulse rate must be between 30 and 250 bpm.')],
            'vitals.weight'         => ['nullable', self::range(1, 500, 'Weight must be between 1 and 500 kg.')],
            'vitals.height'         => ['nullable', self::range(30, 250, 'Height must be between 30 and 250 cm.')],
            'vitals.bmi'            => ['nullable'],
        ];
    }

    private static function bloodPressure(string $attribute, mixed $value, Closure $fail): void
    {
        if (! preg_match('/^\s*(\d{2,3})\s*\/\s*(\d{2,3})/', (string) $value, $m)) {
            $fail('Blood pressure must look like 120/80.');
            return;
        }

        [$sys, $dia] = [(int) $m[1], (int) $m[2]];
        if ($sys < 50 || $sys > 260 || $dia < 30 || $dia > 160 || $sys <= $dia) {
            $fail('Blood pressure is outside the expected range (for example 120/80).');
        }
    }

    private static function range(float $min, float $max, string $message): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($min, $max, $message) {
            // the first number in the text, so "36.6 °C" and "75 bpm" from older entries still count
            if (! is_scalar($value) || ! preg_match('/-?\d+(?:\.\d+)?/', (string) $value, $m)) {
                $fail($message);
                return;
            }

            $n = (float) $m[0];
            if ($n < $min || $n > $max) {
                $fail($message);
            }
        };
    }
}
