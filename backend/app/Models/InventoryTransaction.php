<?php

namespace App\Models;

use App\Support\CacheVersion;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryTransaction extends Model
{
    protected $fillable = [
        'item_id',
        'batch_id',
        'type',
        'quantity',
        'reason',
        'consultation_type',
        'consultation_id',
        'patient_user_id',
        'recorded_by',
        'transaction_date',
        'notes',
    ];

    protected $casts = [
        'quantity'         => 'integer',
        'consultation_id'  => 'integer',
        'transaction_date' => 'date:Y-m-d',
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
            'quantity'         => 'integer',
            'consultation_id'  => 'integer',
            'transaction_date' => 'date:Y-m-d',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'item_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(InventoryBatch::class, 'batch_id');
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function patientUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'patient_user_id');
    }
}
