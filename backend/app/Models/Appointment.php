<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Appointment extends Model
{
    protected $fillable = [
        'patient_id',
        'service_id',
        'staff_id',
        'scheduled_at',
        'status',
        'is_read',
        'notes',
        'cancellation_reason',
        'appointment_type',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'is_read'      => 'boolean',
        ];
    }

    protected $appends = [
        'appointment_date',
        'appointment_time',
    ];

    public function getAppointmentDateAttribute(): ?string
    {
        return $this->scheduled_at ? $this->scheduled_at->format('Y-m-d') : null;
    }

    public function getAppointmentTimeAttribute(): ?string
    {
        return $this->scheduled_at ? $this->scheduled_at->format('g:i A') : null;
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(ClinicService::class, 'service_id');
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_id');
    }

    public function clinicRecord(): HasOne
    {
        return $this->hasOne(ClinicRecord::class);
    }

    public function dentalConsultation(): HasOne
    {
        return $this->hasOne(DentalConsultation::class);
    }
}
