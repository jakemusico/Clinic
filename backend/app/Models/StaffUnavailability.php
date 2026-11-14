<?php

namespace App\Models;

use App\Models\Concerns\NormalizesText;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffUnavailability extends Model
{
    use NormalizesText;

    protected array $properCaseFields = ['reason'];

    protected $table = 'clinic_staff_unavailability';

    protected $fillable = [
        'user_id',
        'unavailable_date',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'unavailable_date' => 'date:Y-m-d',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
