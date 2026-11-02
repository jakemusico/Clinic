<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'title',
        'name',
        'first_name',
        'middle_name',
        'last_name',
        'suffix',
        'email',
        'avatar',
        'password',
        'role_id',
        'role',
        'student_id',
        'department',
        'license_no',
        'specialization',
        'grade_level',
        'section',
        'school_year',
        'contact_no',
        'address',
        'age',
        'date_of_birth',
        'sex',
        'is_active',
        'must_change_password',
        'has_medical_access',
        'terms_accepted_at',
        'guardian_relationship',
        'last_active_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $appends = [
        'name',
        'role_slug',
        'avatar_url',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at'   => 'datetime',
            'last_active_at'      => 'datetime',
            'password'            => 'hashed',
            'is_active'           => 'boolean',
            'must_change_password'=> 'boolean',
            'has_medical_access'  => 'boolean',
        ];
    }

    // --- Computed Accessors ---

    /**
     * Compute full name from first_name, middle_name, last_name, suffix.
     * Keeps first_name, middle_name, last_name, suffix as the single source of truth.
     */
    public function getNameAttribute(): string
    {
        $parts = array_filter([
            $this->first_name,
            $this->middle_name,
            $this->last_name,
            $this->suffix,
        ], fn($p) => !is_null($p) && trim($p) !== '');

        $computed = implode(' ', $parts);
        if ($this->title) {
            $computed = trim($this->title . ' ' . $computed);
        }

        return $computed ?: ($this->attributes['name'] ?? '');
    }

    /**
     * Public URL of the profile photo, or null when the user has none.
     * `avatar` stores only the relative path inside the public disk
     * (e.g. "profile-photos/user3_<uuid>.jpg"). The URL is returned relative
     * to the site root so it works from any host the app is opened on
     * (localhost, LAN IP on a phone, production domain).
     */
    public function getAvatarUrlAttribute(): ?string
    {
        $path = $this->attributes['avatar'] ?? null;

        if (! is_string($path) || $path === '' || str_contains($path, '..')) {
            return null;
        }

        return '/storage/' . ltrim($path, '/');
    }

    /**
     * The standard user JSON used by the auth / profile endpoints.
     */
    public function toApiArray(): array
    {
        $this->loadMissing(['patient', 'roleRelation']);

        $payload = $this->toArray();
        $payload['name']      = $this->name;
        $payload['role']      = $this->role_slug;
        $payload['role_id']   = $this->role_id;
        $payload['role_name'] = $this->role_name;
        $payload['patient']   = $this->patient;

        return $payload;
    }

    /**
     * Accessor for role slug, resolving from roleRelation relationship or existing role column.
     * Note: We use roleRelation (not role) to avoid naming conflict with the `role` DB column.
     */
    public function getRoleSlugAttribute(): ?string
    {
        // If roleRelation is already loaded in the relations array, use it
        if ($this->relationLoaded('roleRelation') && $this->getRelation('roleRelation')) {
            return $this->getRelation('roleRelation')->slug;
        }
        // Fallback to the raw role column value
        return $this->attributes['role'] ?? null;
    }

    /**
     * Accessor for role display name.
     */
    public function getRoleNameAttribute(): ?string
    {
        if ($this->relationLoaded('roleRelation') && $this->getRelation('roleRelation')) {
            return $this->getRelation('roleRelation')->name;
        }
        if (!empty($this->role_id)) {
            return Role::find($this->role_id)?->name;
        }
        return null;
    }

    // --- Relationships ---

    /**
     * BelongsTo Role (named roleRelation to avoid conflict with the `role` column).
     * Use ->load('roleRelation') or ->with('roleRelation') everywhere.
     */
    public function roleRelation(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function patient(): HasOne
    {
        return $this->hasOne(Patient::class);
    }

    public function staffSchedules(): HasMany
    {
        return $this->hasMany(ClinicStaffSchedule::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }

    public function clinicRecordsCreated(): HasMany
    {
        return $this->hasMany(ClinicRecord::class, 'created_by');
    }

    public function appointmentsAsStaff(): HasMany
    {
        return $this->hasMany(Appointment::class, 'staff_id');
    }

    // --- Role Helpers ---

    public function isAdmin(): bool
    {
        return $this->role_slug === 'admin' || ($this->attributes['role'] ?? '') === 'admin';
    }

    public function isClinicStaff(): bool
    {
        return in_array($this->role_slug, ['clinic_staff', 'nurse']) || in_array($this->attributes['role'] ?? '', ['clinic_staff', 'nurse']);
    }

    public function isDentist(): bool
    {
        return $this->role_slug === 'dentist' || ($this->attributes['role'] ?? '') === 'dentist';
    }

    public function isStudent(): bool
    {
        return $this->role_slug === 'student' || ($this->attributes['role'] ?? '') === 'student';
    }

    public function isFacultyStaff(): bool
    {
        return in_array($this->role_slug, ['faculty_staff', 'faculty']) || in_array($this->attributes['role'] ?? '', ['faculty_staff', 'faculty']);
    }

    protected static function booted()
    {
        static::creating(function ($user) {
            if (empty($user->title)) {
                $role = $user->role_slug ?? $user->attributes['role'] ?? '';
                if ($role === 'dentist') {
                    $user->title = 'Dr.';
                } elseif (in_array($role, ['clinic_staff', 'nurse'])) {
                    $user->title = 'Nurse';
                }
            }
        });
        
        static::saving(function ($user) {
            // Keep the old `name` column synced from split columns
            $parts = array_filter([
                $user->first_name,
                $user->middle_name,
                $user->last_name,
                $user->suffix,
            ], fn($p) => !is_null($p) && trim($p) !== '');
            $fullName = implode(' ', $parts);
            if ($user->title) {
                $fullName = trim($user->title . ' ' . $fullName);
            }
            if ($fullName) {
                $user->attributes['name'] = $fullName;
            }

            // Sync role_id and role column
            if (!empty($user->role_id)) {
                $role = Role::find($user->role_id);
                if ($role) {
                    $user->attributes['role'] = $role->slug;
                }
            } elseif (!empty($user->attributes['role'])) {
                $slug = $user->attributes['role'];
                if ($slug === 'nurse') $slug = 'clinic_staff';
                $role = Role::where('slug', $slug)->orWhere('slug', $user->attributes['role'])->first();
                if ($role) {
                    $user->role_id = $role->id;
                    $user->attributes['role'] = $role->slug;
                }
            }
        });
    }
}
