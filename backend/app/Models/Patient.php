<?php

namespace App\Models;

use App\Support\PhoneNumber;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Patient extends Model
{
    protected $fillable = [
        'user_id',
        'blood_type',
        'allergies',
        'medical_history',
        'current_medications',
        'medical_conditions',
        'other_health_notes',
        'date_of_birth',
        'gender',
        'age',
        'emergency_contact',
        'guardian_name',
        'guardian_relationship',
        'guardian_contact',
        'guardian_email',
        'emergency_name',
        'emergency_relationship',
        'emergency_contact_no',
        'emergency_alt_contact',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date:Y-m-d',
        ];
    }

    // Phone numbers are always stored as 09XXXXXXXXX (see App\Support\PhoneNumber).

    protected function guardianContact(): Attribute
    {
        return Attribute::set(fn ($value) => PhoneNumber::clean($value));
    }

    protected function emergencyContactNo(): Attribute
    {
        return Attribute::set(fn ($value) => PhoneNumber::clean($value));
    }

    protected function emergencyAltContact(): Attribute
    {
        return Attribute::set(fn ($value) => PhoneNumber::clean($value));
    }

    protected function emergencyContact(): Attribute
    {
        return Attribute::set(fn ($value) => PhoneNumber::clean($value));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    public function clinicRecords(): HasMany
    {
        return $this->hasMany(ClinicRecord::class);
    }

    public function dentalConsultations(): HasMany
    {
        return $this->hasMany(DentalConsultation::class);
    }
}
