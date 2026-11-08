<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Cache invalidation with VERSIONED KEYS (no cache tags, so it works on the file driver as well as Redis).
 *
 * Every group of cached data has a version number. Cached keys contain it:
 *
 *     Cache::remember(CacheVersion::key('dashboard', 'charts', $role), 60, fn () => ...);
 *
 * When the data behind the group changes, bump() gives the group a new version. The old entries are never
 * read again (and expire on their own), so the next request rebuilds them from fresh data.
 *
 * Groups
 *   dashboard    consultations (medical + dental): dashboard charts and symptoms
 *   stock        inventory items, batches, transactions: stock snapshot and alert counts
 *   users        user accounts: registered-student count, staff lists
 *   services     clinic services
 *   sections     sections and grade levels
 *   settings     system settings (clinic info, terms ...)
 *   calendar     calendar events
 *   announcements announcements
 *
 * Never put patient records, vitals, chat messages, slot availability, stock reads that decide a dispense or
 * anything per user/role WITHOUT the user id / role in its key behind these.
 */
final class CacheVersion
{
    private const PREFIX = 'cv:';

    /** The current version of a group (created on first use). */
    public static function get(string $group): string
    {
        $key = self::PREFIX . $group;
        $version = Cache::get($key);

        if ($version === null) {
            $version = self::newVersion();
            // add(): if two requests race, both end up using the same stored version
            if (! Cache::add($key, $version)) {
                $version = Cache::get($key, $version);
            }
        }

        return (string) $version;
    }

    /** A cache key that contains the group's version and the given parts. */
    public static function key(string $group, string ...$parts): string
    {
        return implode(':', array_merge(['cache', $group, 'v' . self::get($group)], $parts));
    }

    /**
     * Start a new version of the group: everything cached under the old one is ignored from now on.
     *
     * Bumped twice when called inside a database transaction: right away, and again once the transaction
     * has committed. Without the second bump, a request that rebuilds the cache between the two moments
     * would store data from BEFORE the commit under the new version.
     */
    public static function bump(string ...$groups): void
    {
        foreach ($groups as $group) {
            Cache::forever(self::PREFIX . $group, self::newVersion());
        }

        if (DB::transactionLevel() > 0) {
            // one "after commit" bump per group is enough, however many rows the transaction saves
            $groups = array_values(array_diff($groups, self::$scheduled));
            if (! $groups) {
                return;
            }
            self::$scheduled = array_merge(self::$scheduled, $groups);

            DB::afterCommit(function () use ($groups) {
                self::$scheduled = array_values(array_diff(self::$scheduled, $groups));
                foreach ($groups as $group) {
                    Cache::forever(self::PREFIX . $group, self::newVersion());
                }
            });
        }
    }

    /** @var string[] groups that already have an "after commit" bump waiting */
    private static array $scheduled = [];

    private static function newVersion(): string
    {
        return str_replace('.', '', sprintf('%.6f', microtime(true))) . random_int(0, 99);
    }
}
