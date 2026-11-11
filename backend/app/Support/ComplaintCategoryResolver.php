<?php

namespace App\Support;

use App\Models\ComplaintCategory;

/**
 * Keeps complaint_category (the display name) and complaint_category_id in sync
 * on consultation records, and resolves a stored category back to its canonical
 * name for charts and reports.
 */
final class ComplaintCategoryResolver
{
    /**
     * For validated request data: an id wins and supplies the canonical name; a
     * bare name is matched back to its category (case-insensitive). Returns []
     * when the request did not touch the category at all, so a partial update
     * never clears it.
     */
    public static function resolve(array $validated): array
    {
        if (! array_key_exists('complaint_category_id', $validated) && ! array_key_exists('complaint_category', $validated)) {
            return [];
        }

        $id   = $validated['complaint_category_id'] ?? null;
        $name = $validated['complaint_category'] ?? null;

        if ($id) {
            $category = ComplaintCategory::find($id);
            if ($category) {
                return ['complaint_category_id' => $category->id, 'complaint_category' => $category->name];
            }
        }

        $name = is_string($name) ? trim($name) : null;
        if ($name !== null && $name !== '') {
            $category = self::findByName($name);
            if ($category) {
                return ['complaint_category_id' => $category->id, 'complaint_category' => $category->name];
            }

            return ['complaint_category_id' => null, 'complaint_category' => $name];
        }

        return ['complaint_category_id' => null, 'complaint_category' => null];
    }

    /**
     * Canonical category name for a stored record: by id first, then by name
     * (case-insensitive, legacy "Other" merged into "Others"). Returns the raw
     * name when it matches no category, or null when the record has none.
     */
    public static function nameFor($id, ?string $name): ?string
    {
        if ($id) {
            $category = ComplaintCategory::find($id);
            if ($category) {
                return $category->name;
            }
        }

        $name = is_string($name) ? trim($name) : null;
        if ($name === null || $name === '') {
            return null;
        }

        $category = self::findByName($name);
        if ($category) {
            return $category->name;
        }

        $key = mb_strtolower($name);
        if ($key === 'other') {
            return 'Others';
        }

        return $name;
    }

    private static function findByName(string $name): ?ComplaintCategory
    {
        $key = mb_strtolower(trim($name));
        if ($key === 'other') {
            $key = 'others';
        }

        return ComplaintCategory::whereRaw('LOWER(name) = ?', [$key])->first();
    }
}
