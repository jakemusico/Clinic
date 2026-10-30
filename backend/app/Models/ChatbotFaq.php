<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatbotFaq extends Model
{
    protected $fillable = [
        'question',
        'answer',
        'category',
        'keywords',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active'  => 'boolean',
            'sort_order' => 'integer',
        ];
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
