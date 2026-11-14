<?php

namespace App\Models;

use App\Models\Concerns\NormalizesText;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClinicStaffSchedule extends Model
{
    use NormalizesText;

    protected array $sentenceCaseFields = ['notes'];

    protected $fillable = [
        'user_id',
        'day_of_week',
        'start_time',
        'end_time',
        'is_available',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'is_available' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
