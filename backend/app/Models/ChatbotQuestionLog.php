<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatbotQuestionLog extends Model
{
    protected $fillable = [
        'faq_id',
        'question',
        'category',
        'user_id',
    ];

    public function faq(): BelongsTo
    {
        return $this->belongsTo(ChatbotFaq::class, 'faq_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
