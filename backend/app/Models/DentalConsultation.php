<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DentalConsultation extends Model
{
    protected $fillable = [
        'patient_id',
        'appointment_id',
        'service_name',
        'created_by',
        'consultation_date',
        'status',
        'reason_for_visit',
        'vitals',
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
            'consultation_date' => 'date:Y-m-d',
            'affected_teeth'    => 'array',
            'vitals'            => 'array',
        ];
    }

    /**
     * Consultations that took place. A pending or cancelled one is not counted in reports and charts.
     * (An older row with no status counts as completed.)
     */
    public function scopeCompleted($query)
    {
        return $query->where(fn ($q) => $q->where('status', 'completed')->orWhereNull('status'));
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
