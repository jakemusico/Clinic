<?php

namespace App\Models;

use App\Models\Concerns\NormalizesText;
use App\Support\PhoneNumber;
use App\Support\Roles;
use Illuminate\Database\Eloquent\Casts\Attribute;
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
    use HasApiTokens, HasFactory, Notifiable, NormalizesText;

    /** Short profile fields stored in Proper Case (emails, phones, IDs and dates are excluded). */
    protected array $properCaseFields = [
        'title', 'first_name', 'middle_name', 'last_name', 'suffix',
        'address', 'department', 'specialization', 'grade_level', 'section',
        'school_year', 'guardian_relationship',
    ];

    /**
     * Mass assignment (create/update/fill with request data) can set these columns.
     *
     * NOT in this list on purpose, so request data can never reach them: `role_id`,
     * `is_active`, `must_change_password` and `has_medical_access`. Set those one by one in code,
     * e.g. `$user->role_id = $role->id;`, after the access decision has been made.
     * `role_id` is the only stored role; `$user->role` is a read/write alias resolved through
     * the roles table (see getRoleAttribute / the saving hook).
     */
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
        'role',
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

    // --- Mutators ---

    /** Always stored as 09XXXXXXXXX (see App\Support\PhoneNumber). */
    protected function contactNo(): Attribute
    {
        return Attribute::set(fn ($value) => PhoneNumber::clean($value));
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

        // External URLs (e.g. a Google profile photo) are used as-is.
        if (preg_match('#^https?://#i', $path)) {
            return $path;
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
     * `role` is not a column anymore: role_id -> roles is the single source of truth.
     * Reading `$user->role` returns the canonical role slug (what the old column held),
     * and writing `$user->role = 'slug'` is resolved to role_id by the saving hook.
     */
    public function getRoleAttribute(): ?string
    {
        return $this->role_slug;
    }

    /**
     * Accessor for role slug, resolved through roleRelation / role_id.
     */
    public function getRoleSlugAttribute(): ?string
    {
        // If roleRelation is already loaded in the relations array, use it
        if ($this->relationLoaded('roleRelation') && $this->getRelation('roleRelation')) {
            return $this->getRelation('roleRelation')->slug;
        }
        return Roles::slugForId($this->role_id);
    }

    /**
     * Accessor for role display name.
     */
    public function getRoleNameAttribute(): ?string
    {
        if ($this->relationLoaded('roleRelation') && $this->getRelation('roleRelation')) {
            return $this->getRelation('roleRelation')->name;
        }
        return Roles::nameForId($this->role_id);
    }

    // --- Relationships ---

    /**
     * BelongsTo Role (named roleRelation to avoid conflict with the `role` accessor).
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

    /** Canonical role (role_slug with the nurse/clinic_staff and faculty aliases resolved). See App\Support\Roles. */
    public function normalizedRole(): ?string
    {
        return Roles::of($this);
    }

    public function isAdmin(): bool
    {
        return Roles::is($this, Roles::ADMIN);
    }

    public function isClinicStaff(): bool
    {
        return Roles::is($this, Roles::NURSE);
    }

    public function isDentist(): bool
    {
        return Roles::is($this, Roles::DENTIST);
    }

    public function isStudent(): bool
    {
        return Roles::is($this, Roles::STUDENT);
    }

    public function isFacultyStaff(): bool
    {
        return Roles::is($this, Roles::FACULTY);
    }

    /**
     * Filter users by role slug(s) — the query-side counterpart of $user->role.
     * Aliases are normalised ('nurse' -> 'clinic_staff', 'faculty' -> 'faculty_staff').
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     */
    public function scopeRoleIs($query, string|array $roles)
    {
        $slugs = collect((array) $roles)
            ->map(fn ($r) => Roles::of($r))
            ->filter()
            ->unique()
            ->values();

        return $query->whereHas('roleRelation', fn ($q) => $q->whereIn('slug', $slugs));
    }

    protected static function booted()
    {
        static::creating(function ($user) {
            if (empty($user->title)) {
                $role = $user->role_slug ?? '';
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

            // `role` is not a column: a slug written to it (e.g. $user->role = 'admin')
            // is resolved to role_id — but only when role_id was not set explicitly,
            // since role_id is the authoritative value — then removed from the attributes
            // so the insert/update never references the dropped column.
            if (array_key_exists('role', $user->attributes)) {
                $slug = Roles::of($user->attributes['role']) ?? $user->attributes['role'];
                if (empty($user->role_id) && $slug) {
                    $role = Role::where('slug', $slug)->first();
                    if ($role) {
                        $user->role_id = $role->id;
                    }
                }
                unset($user->attributes['role']);
            }
        });
    }
}
