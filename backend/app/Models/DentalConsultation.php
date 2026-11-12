<?php

namespace App\Models;

use App\Support\CacheVersion;
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
        'complaint_category_id',
        'affected_teeth',
        'dental_findings',
        'diagnosis',
        'treatment_performed',
        'recommendations',
        'notes',
        'staff_notes',
    ];

    /** Reports caches are rebuilt after any change to the underlying rows. */
    protected static function booted(): void
    {
        static::saved(fn () => CacheVersion::bump('reports'));
        static::deleted(fn () => CacheVersion::bump('reports'));
    }

    protected function casts(): array
    {
        return [
            'consultation_date' => 'date:Y-m-d',
            'affected_teeth'    => 'array',
            'vitals'            => 'array',
            'reason_for_visit' => 'encrypted',
            'dental_findings' => 'encrypted',
            'diagnosis' => 'encrypted',
            'treatment_performed' => 'encrypted',
            'recommendations' => 'encrypted',
            'notes' => 'encrypted',
            'staff_notes' => 'encrypted',
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

    public function complaintCategory(): BelongsTo
    {
        return $this->belongsTo(ComplaintCategory::class, 'complaint_category_id');
    }

    public function dentist(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
