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
            'vitals.temperature'    => ['nullable', 'numeric', self::range(30, 45, 'Temperature must be between 30 and 45 °C.')],
            'vitals.pulse_rate'     => ['nullable', 'numeric', self::range(30, 250, 'Pulse rate must be between 30 and 250 bpm.')],
            'vitals.weight'         => ['nullable', 'numeric', self::range(1, 500, 'Weight must be between 1 and 500 kg.')],
            'vitals.height'         => ['nullable', 'numeric', self::range(30, 250, 'Height must be between 30 and 250 cm.')],
            'vitals.bmi'            => ['nullable', 'numeric', 'between:10,60'],
        ];
    }

    private static function bloodPressure(string $attribute, mixed $value, Closure $fail): void
    {
        // Skip validation if empty (nullable)
        if ($value === null || $value === '') {
            return;
        }

        // Strict format: digits/digits with optional whitespace, no trailing text (fix #5)
        if (! preg_match('/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/', (string) $value, $m)) {
            $fail('Blood pressure must be in format 120/80 (numbers only).');
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
            // Skip validation if empty (nullable)
            if ($value === null || $value === '') {
                return;
            }

            // Strict numeric only — 'numeric' rule already ran, so this is just range check (fix #5)
            if (! is_numeric($value)) {
                $fail($message);
                return;
            }

            $n = (float) $value;
            if ($n < $min || $n > $max) {
                $fail($message);
            }
        };
    }

    /**
     * Compute BMI server-side from weight and height (fix #5).
     * Call this after validation, before saving vitals.
     */
    public static function computeBMI(?array $vitals): ?array
    {
        if (! $vitals || empty($vitals)) {
            return $vitals;  // Return as-is (empty array or null)
        }

        $weight = $vitals['weight'] ?? null;
        $height = $vitals['height'] ?? null;

        // Only compute if both weight (kg) and height (cm) are present, numeric, and non-zero
        if (! empty($weight) && ! empty($height) && is_numeric($weight) && is_numeric($height) && (float) $height > 0 && (float) $weight > 0) {
            $heightM = (float) $height / 100;
            $bmi = (float) $weight / ($heightM * $heightM);
            $vitals['bmi'] = round($bmi, 2);
        }

        return $vitals;
    }
}
