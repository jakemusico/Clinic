<?php

namespace App\Support;

use Illuminate\Support\Facades\Crypt;

/**
 * Decrypts a value that may be Laravel ciphertext or still-plaintext
 * (rows written before the encrypted casts / data:encrypt-existing ran).
 * Returns the input unchanged when it isn't valid ciphertext.
 */
final class EncryptedFields
{
    public static function decrypt(mixed $value): mixed
    {
        if (! is_string($value) || $value === '') {
            return $value;
        }

        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            return $value;
        }
    }
}
