<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatbotFaq extends Model
{
    protected $fillable = [
        'question',
        'answer',
        'category',
        'category_id',
        'keywords',
        'sort_order',
        'is_active',
        'show_on_help',
    ];

    protected function casts(): array
    {
        return [
            'is_active'    => 'boolean',
            'show_on_help' => 'boolean',
            'sort_order'   => 'integer',
        ];
    }

    /**
     * The category row this FAQ belongs to. `category` stays as the denormalized
     * name snapshot used for display and filtering.
     */
    public function categoryRelation(): BelongsTo
    {
        return $this->belongsTo(ChatbotCategory::class, 'category_id');
    }

    /**
     * Return keywords as an array.
     */
    public function getKeywordsArrayAttribute(): array
    {
        if (empty($this->keywords)) {
            return [];
        }
        return array_map('trim', explode(',', strtolower($this->keywords)));
    }

    /**
     * Score a message against this FAQ's keywords (0 = no match).
     */
    public function matchScore(string $message): int
    {
        $msg      = strtolower($message);
        $keywords = $this->keywords_array;
        $score    = 0;

        foreach ($keywords as $kw) {
            if ($kw !== '' && str_contains($msg, $kw)) {
                $score++;
            }
        }

        return $score;
    }
}
