<?php

namespace App\Models;

use App\Models\Concerns\NormalizesText;
use App\Support\CacheVersion;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    use NormalizesText;

    protected array $properCaseFields   = ['name', 'location'];
    protected array $sentenceCaseFields = ['description'];

    protected $fillable = [
        'name',
        'category',
        'unit',
        'reorder_level',
        'is_active',
        'equipment_status',
        'location',
        'description',
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
            'is_active'     => 'boolean',
            'reorder_level' => 'integer',
        ];
    }

    public function batches(): HasMany
    {
        return $this->hasMany(InventoryBatch::class, 'item_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(InventoryTransaction::class, 'item_id');
    }

    /**
     * Current stock = sum(IN transactions) - sum(OUT transactions).
     * For Equipment items, always return null (no quantity tracking).
     */
    public function currentStockAttribute(): ?int
    {
        if ($this->category === 'Equipment') {
            return null;
        }
        $inQty  = $this->transactions()->where('type', 'IN')->sum('quantity');
        $outQty = $this->transactions()->where('type', 'OUT')->sum('quantity');
        return max(0, $inQty - $outQty);
    }
}
