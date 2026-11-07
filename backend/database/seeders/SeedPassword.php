<?php

namespace Database\Seeders;

use Illuminate\Support\Str;

/**
 * Passwords for seeded demo accounts.
 *
 * Only a local (or testing) environment gets the well-known demo password. Anywhere else every
 * account gets its own random password, which the seeder prints once (it is stored hashed only).
 */
final class SeedPassword
{
    /** The demo password. Local and testing environments only. */
    public const LOCAL = 'password123';

    public static function isLocal(): bool
    {
        return app()->environment(['local', 'testing']);
    }

    /** A password for one seeded account. */
    public static function generate(): string
    {
        return self::isLocal() ? self::LOCAL : Str::password(20, symbols: false);
    }
}
