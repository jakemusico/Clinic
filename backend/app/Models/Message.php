<?php

namespace App\Models;

use App\Models\Concerns\NormalizesText;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Message extends Model
{
    use HasFactory, SoftDeletes, NormalizesText;

    protected array $sentenceCaseFields = ['body'];

    protected $fillable = [
        'conversation_id',
        'sender_id',
        'client_id',
        'body',
        'read_at',
        'edited_at',
    ];

    protected $appends = [
        'is_deleted',
    ];

    protected function casts(): array
    {
        return [
            'read_at'    => 'datetime',
            'edited_at'  => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function getIsDeletedAttribute(): bool
    {
        return $this->trashed() || !empty($this->deleted_at);
    }

    public function toArray(): array
    {
        $arr = parent::toArray();
        $isDeleted = !empty($arr['deleted_at']) || !empty($this->deleted_at) || $this->trashed();
        $arr['is_deleted'] = (bool) $isDeleted;
        if ($isDeleted) {
            $arr['body'] = null;
        }
        return $arr;
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
}
