<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DentalConsultation extends Model
{
    protected $fillable = [
        'patient_id',
        'appointment_id',
        'created_by',
        'consultation_date',
        'status',
        'reason_for_visit',
        'complaint_category',
        'affected_teeth',
        'dental_findings',
        'diagnosis',
        'treatment_performed',
        'recommendations',
        'notes',
        'staff_notes',
    ];

    protected function casts(): array
    {
        return [
            'consultation_date' => 'date',
            'affected_teeth'    => 'array',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function dentist(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
