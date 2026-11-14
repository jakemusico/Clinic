<?php

namespace App\Models;

use App\Support\CacheVersion;
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

    /**
     * The only columns of the attending staff member that appointment responses carry:
     * what is needed to show a name and a photo. No email, contact number, address, date of birth
     * or license number. (name, role and avatar_url are computed from these.)
     */
    public const STAFF_COLUMNS = ['id', 'name', 'title', 'first_name', 'middle_name', 'last_name', 'suffix', 'role_id', 'avatar'];

    /** The only columns of the patient's account that appointment responses carry. */
    public const PATIENT_USER_COLUMNS = ['id', 'name', 'title', 'first_name', 'middle_name', 'last_name', 'suffix', 'student_id', 'department', 'grade_level', 'section', 'role_id', 'avatar'];

    /**
     * Eager-load list for appointment responses: explicit columns for the patient and the staff
     * member, never the whole user row (and never the patient's medical profile).
     *
     * @param  string[]  $extra  further relations, e.g. ['clinicRecord']
     * @return string[]
     */
    public static function safeRelations(array $extra = []): array
    {
        return array_merge([
            'patient:id,user_id',
            'patient.user:' . implode(',', self::PATIENT_USER_COLUMNS),
            'service',
            'staff:' . implode(',', self::STAFF_COLUMNS),
        ], $extra);
    }

    /** The relation string for the attending staff member: ->load(['service', Appointment::staffRelation()]). */
    public static function staffRelation(): string
    {
        return 'staff:' . self::staffColumns();
    }

    /** STAFF_COLUMNS as a comma list, for a relation string such as 'createdBy:' . Appointment::staffColumns(). */
    public static function staffColumns(): string
    {
        return implode(',', self::STAFF_COLUMNS);
    }

    /** Reports caches are rebuilt after any change to the underlying rows. */
    protected static function booted(): void
    {
        static::saved(fn () => CacheVersion::bump('reports'));
        static::deleted(fn () => CacheVersion::bump('reports'));
    }

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
