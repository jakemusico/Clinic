<?php

namespace App\Support;

/**
 * System-wide text casing rules for user-entered content.
 *
 *  - properCase():   "JAKE musico" / "jake MUSICO" -> "Jake Musico".
 *                    Used for short fields (names, addresses, departments...).
 *  - sentenceCase(): uppercases only the first letter of each sentence and
 *                    leaves the rest of the text untouched. Used for long
 *                    free-text fields (notes, diagnosis, messages...).
 *
 * Both are idempotent and null/empty safe.
 */
final class TextNormalizer
{
    /**
     * Words that stay lowercase inside a name/address unless they are the
     * first word ("Maria de la Cruz", "University of the Philippines").
     */
    private const PARTICLES = [
        'de', 'der', 'den', 'di', 'da', 'dos', 'das', 'du',
        'van', 'von', 'ten', 'ter', 'y', 'e', 'of', 'the',
    ];

    /**
     * Particles that only stay lowercase when they continue a particle chain
     * ("de la", "van der") — otherwise they are capitalized, so "John La Salle"
     * does not become "John la Salle".
     */
    private const CHAIN_PARTICLES = ['la', 'le', 'lo', 'al', 'el', 'bin', 'bint'];

    /** Short forms kept in their conventional casing. */
    private const SMALL_WORDS = [
        'jr' => 'Jr.', 'sr' => 'Sr.', 'esq' => 'Esq.',
        'ii' => 'II', 'iii' => 'III', 'iv' => 'IV', 'v' => 'V', 'vi' => 'VI',
        'vii' => 'VII', 'viii' => 'VIII', 'ix' => 'IX', 'x' => 'X',
        'xi' => 'XI', 'xii' => 'XII',
        'st' => 'St.', 'mt' => 'Mt.', 'sta' => 'Sta.',
    ];

    public static function properCase(?string $text): ?string
    {
        if ($text === null || trim($text) === '') {
            return $text;
        }

        // Split on whitespace, keeping the separators so spacing is preserved.
        $parts = preg_split('/(\s+)/u', $text, -1, PREG_SPLIT_DELIM_CAPTURE);

        $out = '';
        $prevWasParticle = false;
        foreach ($parts as $part) {
            if ($part === '' || preg_match('/^\s+$/u', $part)) {
                $out .= $part;
                continue;
            }

            $isFirstWord = trim($out) === '';
            $cased = self::properWord($part, $isFirstWord, $prevWasParticle);
            $prevWasParticle = self::isParticleWord($part);
            $out .= $cased;
        }

        return $out;
    }

    /**
     * Uppercase the first letter of each sentence; never lowercases anything.
     */
    public static function sentenceCase(?string $text): ?string
    {
        if ($text === null || $text === '') {
            return $text;
        }

        $out = '';
        $len = mb_strlen($text);
        $newSentence = true;

        for ($i = 0; $i < $len; $i++) {
            $ch = mb_substr($text, $i, 1);

            if ($newSentence && preg_match('/\p{L}/u', $ch)) {
                $ch = mb_strtoupper($ch);
                $newSentence = false;
            }
            $out .= $ch;

            if ($ch === '!' || $ch === '?') {
                $newSentence = true;
            } elseif ($ch === '.') {
                // '.' ends a sentence only when it is not part of an abbreviation
                // or initial ("e.g.", "U.S.A.", "2.5"): the word-so-far must be
                // longer than one letter and contain no earlier '.'.
                $wordStart = $i;
                while ($wordStart > 0 && ! preg_match('/\s/u', mb_substr($text, $wordStart - 1, 1))) {
                    $wordStart--;
                }
                $wordSoFar = mb_substr($text, $wordStart, $i - $wordStart + 1);
                $stem = rtrim($wordSoFar, '.');
                if (mb_strlen($stem) > 1 && ! str_contains($stem, '.')) {
                    $newSentence = true;
                }
            }
        }

        return $out;
    }

    /**
     * Proper-case a single whitespace-delimited token, preserving any
     * non-letter characters around and inside it.
     */
    private static function properWord(string $word, bool $isFirstWord, bool $prevWasParticle): string
    {
        // Peel off leading/trailing non-letter characters (quotes, brackets...).
        if (! preg_match('/\p{L}/u', $word)) {
            return $word;
        }
        $prefix = '';
        $suffix = '';
        $core   = $word;
        if (preg_match('/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/us', $word, $m)) {
            $prefix = $m[1];
            $core   = $m[2];
            $suffix = $m[3];
        }

        // Hyphenated names: "mary-ann" -> "Mary-Ann" (each segment cased on its own,
        // but a segment that is itself a particle chain stays lowercase mid-name).
        if (str_contains($core, '-')) {
            $segments = explode('-', $core);
            $casedSegs = [];
            foreach ($segments as $j => $seg) {
                $casedSegs[] = self::properSegment($seg, $isFirstWord && $j === 0, false);
            }
            $casedCore = implode('-', $casedSegs);
        } else {
            $casedCore = self::properSegment($core, $isFirstWord, $prevWasParticle);
        }

        // A mapped form may already end with a period ("Jr.", "St.") — don't double it
        // when the original punctuation was stripped into $suffix.
        if (str_ends_with($casedCore, '.') && str_starts_with($suffix, '.')) {
            $suffix = ltrim($suffix, '.');
        }

        return $prefix . $casedCore . $suffix;
    }

    /** Proper-case one hyphen-free segment (may contain apostrophes/digits). */
    private static function properSegment(string $seg, bool $isFirstWord, bool $prevWasParticle): string
    {
        $lower = mb_strtolower($seg);

        // Lookup key ignores surrounding punctuation ("Jr." -> "jr", "(jr)" handled by caller).
        $key = trim($lower, ".,;:!?()");

        // Roman numerals / conventional short forms ("Jr." already carries its period).
        if (isset(self::SMALL_WORDS[$key])) {
            return self::SMALL_WORDS[$key];
        }

        // Particles stay lowercase mid-name; chain particles only after another particle.
        if (in_array($key, self::PARTICLES, true) && ! $isFirstWord) {
            return $lower;
        }
        if (in_array($key, self::CHAIN_PARTICLES, true) && ! $isFirstWord && ! $prevWasParticle) {
            // e.g. "La" in "John La Salle" -> capitalized; "la" in "de la" -> lowercase
            return self::capitalizeSegment($lower);
        }
        if (in_array($key, self::CHAIN_PARTICLES, true) && ! $isFirstWord && $prevWasParticle) {
            return $lower;
        }
        if (in_array($key, self::PARTICLES, true) && $isFirstWord) {
            return self::capitalizeSegment($lower);
        }

        // Mc/Mac prefixes: mcdonald -> McDonald, macarthur -> MacArthur.
        // 'mac' only splits before a vowel so "Machado"/"Mackenzie" stay intact.
        if (preg_match('/^mc(.{2,})$/u', $lower, $m)) {
            return 'Mc' . self::capitalizeAfterApostrophes($m[1]);
        }
        if (preg_match('/^mac([aeiou].{2,})$/u', $lower, $m)) {
            return 'Mac' . self::capitalizeAfterApostrophes($m[1]);
        }

        return self::capitalizeSegment($lower);
    }

    /** Uppercase the first letter and the letter after each apostrophe. */
    private static function capitalizeSegment(string $lower): string
    {
        return self::capitalizeAfterApostrophes($lower);
    }

    private static function capitalizeAfterApostrophes(string $lower): string
    {
        // Uppercase first letter and any letter following an apostrophe (O'Brien).
        $out = preg_replace_callback(
            "/(^|')([a-z])/u",
            fn ($m) => $m[1] . mb_strtoupper($m[2]),
            $lower
        );
        return $out ?? $lower;
    }

    private static function isParticleWord(string $word): bool
    {
        $key = mb_strtolower(trim($word, ".,;:!?()\"'"));
        return in_array($key, self::PARTICLES, true) || in_array($key, self::CHAIN_PARTICLES, true);
    }
}
