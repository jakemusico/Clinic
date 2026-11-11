<?php

namespace App\Models;

use App\Support\CacheVersion;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryBatch extends Model
{
    protected $fillable = [
        'item_id',
        'batch_no',
        'supplier',
        'quantity_in',
        'quantity_used',
        'expiry_date',
        'received_date',
        'received_by',
        'notes',
    ];

    protected $casts = [
        'expiry_date'   => 'date:Y-m-d',
        'received_date' => 'date:Y-m-d',
        'quantity_in'   => 'integer',
        'quantity_used' => 'integer',
    ];

    /** Reports caches are rebuilt after any change to the underlying rows. */
    protected static function booted(): void
    {
        static::saved(fn () => CacheVersion::bump('reports'));
        static::deleted(fn () => CacheVersion::bump('reports'));
    }

    protected function casts(): array
    {
        return [
            'expiry_date'   => 'date:Y-m-d',
            'received_date' => 'date:Y-m-d',
            'quantity_in'   => 'integer',
            'quantity_used' => 'integer',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'item_id');
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(InventoryTransaction::class, 'batch_id');
    }

    /**
     * Remaining quantity in this batch.
     */
    public function getRemainingAttribute(): int
    {
        return max(0, $this->quantity_in - $this->quantity_used);
    }

    /**
     * Is this batch expired?
     */
    public function getIsExpiredAttribute(): bool
    {
        return $this->expiry_date && $this->expiry_date->isPast();
    }

    /**
     * Is this batch expiring within 30 days?
     */
    public function getIsExpiringSoonAttribute(): bool
    {
        return $this->expiry_date
            && !$this->isExpired
            && $this->expiry_date->lte(now()->addDays(30));
    }
}
