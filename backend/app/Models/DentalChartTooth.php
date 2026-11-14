<?php

namespace App\Models;

use App\Models\Concerns\NormalizesText;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DentalChartTooth extends Model
{
    use NormalizesText;

    protected array $sentenceCaseFields = ['notes'];

    protected $fillable = [
        'dental_chart_id',
        'tooth_number',
        'condition',
        'notes',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'notes' => 'encrypted',
        ];
    }

    public function dentalChart(): BelongsTo
    {
        return $this->belongsTo(DentalChart::class);
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
