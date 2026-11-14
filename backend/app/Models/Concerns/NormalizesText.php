<?php

namespace App\Models\Concerns;

use App\Support\TextNormalizer;
use Illuminate\Database\Eloquent\Model;

/**
 * Auto-format user-entered text before every save.
 *
 * A model opts in by using this trait and overriding normalizedTextFields():
 *
 *   protected array $properCaseFields   = ['first_name', 'last_name', ...];
 *   protected array $sentenceCaseFields = ['notes', 'diagnosis', ...];
 *
 * Or return the map from normalizedTextFields(). Values are read through the
 * normal accessors (so encrypted casts decrypt first) and written back through
 * setAttribute (so they are re-encrypted on save). Fields that are enums,
 * identifiers, emails, phones, dates, JSON blobs, etc. must simply be left out.
 */
trait NormalizesText
{
    public static function bootNormalizesText(): void
    {
        static::saving(function (Model $model) {
            $model->applyTextNormalization();
        });
    }

    public function applyTextNormalization(): void
    {
        $map = $this->normalizedTextFields();

        foreach (['proper' => 'properCase', 'sentence' => 'sentenceCase'] as $group => $method) {
            foreach ($map[$group] ?? [] as $field) {
                // Only touch attributes actually present on this model instance.
                if (! array_key_exists($field, $this->attributes)) {
                    continue;
                }
                $value = $this->getAttribute($field);
                if (! is_string($value) || trim($value) === '') {
                    continue;
                }
                $normalized = TextNormalizer::$method($value);
                if ($normalized !== $value) {
                    $this->setAttribute($field, $normalized);
                }
            }
        }
    }

    /**
     * @return array{proper?:string[],sentence?:string[]}
     */
    public function normalizedTextFields(): array
    {
        return [
            'proper'   => $this->properCaseFields ?? [],
            'sentence' => $this->sentenceCaseFields ?? [],
        ];
    }
}
