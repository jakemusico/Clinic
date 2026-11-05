<?php

namespace App\Support;

/**
 * Text shown when a value is missing (report rows, dashboard tables).
 * Use this instead of typing the character, so it cannot be damaged by an editor or script
 * that saves the file with the wrong encoding.
 */
final class Placeholder
{
    /** Em dash. */
    public const EMPTY = "\u{2014}";
}
