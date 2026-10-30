<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DentalChart extends Model
{
    protected $fillable = [
        'patient_id',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function teeth(): HasMany
    {
        return $this->hasMany(DentalChartTooth::class);
    }

    /**
     * Returns the latest recorded condition for each tooth number.
     */
    public function latestTeeth(): HasMany
    {
        return $this->hasMany(DentalChartTooth::class)
                    ->orderBy('created_at', 'desc');
    }
}
