<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClinicRecord extends Model
{
    protected $fillable = [
        'patient_id',
        'appointment_id',
        'created_by',
        'diagnosis',
        'prescription',
        'remarks',
        'treatment',
        'visit_date',
        'vitals',
        'chief_complaint',
        'complaint_category',
        'symptoms',
        'assessment',
        'recommendation',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'visit_date' => 'date',
            'vitals'     => 'array',
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

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
