<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffUnavailability extends Model
{
    protected $table = 'clinic_staff_unavailability';

    protected $fillable = [
        'user_id',
        'unavailable_date',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'unavailable_date' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
