<?php

namespace App\Models;

use App\Support\CacheVersion;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClinicRecord extends Model
{
    protected $fillable = [
        'patient_id',
        'appointment_id',
        'service_name',
        'created_by',
        'diagnosis',
        'prescription',
        'remarks',
        'treatment',
        'visit_date',
        'vitals',
        'chief_complaint',
        'complaint_category',
        'complaint_category_id',
        'symptoms',
        'assessment',
        'recommendation',
        'notes',
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
            'visit_date' => 'date:Y-m-d',
            'vitals'     => 'array',
            'diagnosis' => 'encrypted',
            'treatment' => 'encrypted',
            'prescription' => 'encrypted',
            'remarks' => 'encrypted',
            'chief_complaint' => 'encrypted',
            'symptoms' => 'encrypted',
            'assessment' => 'encrypted',
            'recommendation' => 'encrypted',
            'notes' => 'encrypted',
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

    public function complaintCategory(): BelongsTo
    {
        return $this->belongsTo(ComplaintCategory::class, 'complaint_category_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
