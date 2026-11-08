<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * One rule for "how many rows may a list return", so no endpoint can be asked for the whole table.
 *
 *   per_page   at least 1 and at most MAX_PER_PAGE (per_page=0 or 100000 can no longer break or flood a page)
 *   all=true / paginate=false   still works for the screens that need every row of a filtered list
 *              (dropdowns, a CSV export), but returns at most ALL_LIMIT rows (EXPORT_LIMIT for an export)
 */
final class Paging
{
    public const MAX_PER_PAGE = 100;

    /** Rows an "all" request may return. */
    public const ALL_LIMIT = 1000;

    /** Rows an export ("all" of the transactions list) may return. */
    public const EXPORT_LIMIT = 5000;

    public static function perPage(Request $request, int $default = 10, int $max = self::MAX_PER_PAGE): int
    {
        return min($max, max(1, (int) $request->input('per_page', $default)));
    }

    public static function wantsAll(Request $request): bool
    {
        return $request->boolean('all') || $request->input('paginate') === 'false';
    }
}
