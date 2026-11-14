<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatbotCategory extends Model
{
    protected $fillable = [
        'name',
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
     * Get FAQs in this category.
     */
    public function faqs()
    {
        return $this->hasMany(ChatbotFaq::class, 'category_id');
    }

    /**
     * Check if this category has any active FAQs with show_on_help enabled.
     */
    public function hasVisibleFaqs(): bool
    {
        return $this->faqs()
            ->where('is_active', true)
            ->where('show_on_help', true)
            ->exists();
    }
}
