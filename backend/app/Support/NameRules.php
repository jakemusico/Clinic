<?php

namespace App\Support;

/**
 * Validation for the parts of a person's name (first, middle, last, suffix, title).
 *
 * Names are printed on records and reports, so they must not be able to carry markup such as
 * `<img onerror=...>`. Only letters (any language), combining marks, spaces, periods, hyphens
 * and apostrophes are allowed, and a name must start with a letter. A suffix may also contain
 * digits ("2nd", "III").
 *
 * Output is escaped as well (frontend utils/escapeHtml.js); this is the second layer.
 */
final class NameRules
{
    /** Letters, marks, spaces, . ' ’ - ; starts with a letter. */
    private const PERSON = '/^\p{L}[\p{L}\p{M}\s.\'’-]*$/u';

    /** Same, plus digits, and may start with a digit ("2nd"). */
    private const SUFFIX = '/^[\p{L}\p{N}][\p{L}\p{M}\p{N}\s.\'’-]*$/u';

    /** Rules to append to a first / middle / last name or title field. */
    public static function person(): array
    {
        return ['regex:' . self::PERSON];
    }

    /** Rules to append to a suffix field. */
    public static function suffix(): array
    {
        return ['regex:' . self::SUFFIX];
    }

    /**
     * Custom messages for the fields above (merge into validate()'s messages).
     *
     * @param  string[]  $personFields  e.g. ['first_name', 'middle_name', 'last_name']
     */
    public static function messages(array $personFields = ['first_name', 'middle_name', 'last_name'], array $suffixFields = ['suffix']): array
    {
        $messages = [];
        foreach ($personFields as $field) {
            $label = ucfirst(str_replace('_', ' ', $field));
            $messages["{$field}.regex"] = "{$label} may only contain letters, spaces, periods, hyphens and apostrophes.";
        }
        foreach ($suffixFields as $field) {
            $messages["{$field}.regex"] = 'Suffix may only contain letters, numbers, spaces, periods and hyphens (for example Jr., III).';
        }

        return $messages;
    }
}
