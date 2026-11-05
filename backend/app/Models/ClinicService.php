<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClinicService extends Model
{
    public const CARE_MEDICAL = 'medical';
    public const CARE_DENTAL  = 'dental';
    public const CARE_TYPES   = [self::CARE_MEDICAL, self::CARE_DENTAL];

    protected $fillable = [
        'name',
        'care_type',
        'description',
        'duration_minutes',
        'fee',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active'        => 'boolean',
            'fee'              => 'decimal:2',
            'duration_minutes' => 'integer',
        ];
    }

    public function scopeCareType(Builder $query, ?string $careType): Builder
    {
        return in_array($careType, self::CARE_TYPES, true)
            ? $query->where('care_type', $careType)
            : $query;
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class, 'service_id');
    }
}
