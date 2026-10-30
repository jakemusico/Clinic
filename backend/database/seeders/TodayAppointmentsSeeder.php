<?php

namespace Database\Seeders;

use App\Models\Appointment;
use App\Models\ClinicRecord;
use App\Models\ClinicService;
use App\Models\DentalConsultation;
use App\Models\Patient;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class TodayAppointmentsSeeder extends Seeder
{
    public function run(): void
    {
        $today = Carbon::today()->toDateString();

        $studentPatient = Patient::whereHas('user', fn($q) => $q->where('role', 'student'))->first() ?? Patient::first();
        $facultyPatient = Patient::whereHas('user', fn($q) => $q->where('role', 'faculty_staff'))->first() ?? $studentPatient;

        $nurseUser = User::where('role', 'clinic_staff')->first() ?? User::first();
        $dentistUser = User::where('role', 'dentist')->first() ?? User::first();

        $medicalService = ClinicService::where('name', 'like', '%Medical Consultation%')->first()
            ?? ClinicService::where('name', 'like', '%First Aid%')->first()
            ?? ClinicService::first();

        $dentalService = ClinicService::where('name', 'like', '%Dental Cleaning%')->first()
            ?? ClinicService::where('name', 'like', '%Dental Consultation%')->first()
            ?? ClinicService::where('name', 'like', '%Tooth%')->first()
            ?? ClinicService::first();

        if ($studentPatient && $medicalService) {
            // 1. Medical Appointment 1 (Confirmed - Waiting in Queue)
            Appointment::firstOrCreate(
                [
                    'patient_id'       => $studentPatient->id,
                    'scheduled_at'     => "{$today} 09:30:00",
                    'appointment_type' => 'medical',
                ],
                [
                    'service_id' => $medicalService->id,
                    'staff_id'   => $nurseUser?->id,
                    'status'     => 'confirmed',
                    'notes'      => 'Routine checkup and vitals assessment',
                ]
            );

            // 2. Medical Appointment 2 (Pending)
            if ($facultyPatient) {
                Appointment::firstOrCreate(
                    [
                        'patient_id'       => $facultyPatient->id,
                        'scheduled_at'     => "{$today} 14:00:00",
                        'appointment_type' => 'medical',
                    ],
                    [
                        'service_id' => $medicalService->id,
                        'staff_id'   => $nurseUser?->id,
                        'status'     => 'pending',
                        'notes'      => 'Follow-up consultation',
                    ]
                );
            }
        }

        if ($facultyPatient && $dentalService) {
            // 3. Dental Appointment 1 (Confirmed - Waiting in Queue)
            Appointment::firstOrCreate(
                [
                    'patient_id'       => $facultyPatient->id,
                    'scheduled_at'     => "{$today} 10:15:00",
                    'appointment_type' => 'dental',
                ],
                [
                    'service_id' => $dentalService->id,
                    'staff_id'   => $dentistUser?->id,
                    'status'     => 'confirmed',
                    'notes'      => 'Routine dental assessment and scaling',
                ]
            );

            // 4. Dental Appointment 2 (Confirmed)
            if ($studentPatient) {
                Appointment::firstOrCreate(
                    [
                        'patient_id'       => $studentPatient->id,
                        'scheduled_at'     => "{$today} 15:30:00",
                        'appointment_type' => 'dental',
                    ],
                    [
                        'service_id' => $dentalService->id,
                        'staff_id'   => $dentistUser?->id,
                        'status'     => 'confirmed',
                        'notes'      => 'Tooth examination and cleaning',
                    ]
                );
            }
        }

        // Consultations completed today
        if ($studentPatient && $nurseUser) {
            ClinicRecord::firstOrCreate(
                [
                    'patient_id' => $studentPatient->id,
                    'visit_date' => $today,
                ],
                [
                    'created_by'      => $nurseUser->id,
                    'diagnosis'       => 'Mild seasonal allergy / Rhinitis',
                    'chief_complaint' => 'Sneezing, nasal congestion',
                    'treatment'       => 'Antihistamine advice, rest and hydration',
                    'vitals'          => ['bp' => '118/76', 'temp' => '36.5', 'pulse' => '72'],
                ]
            );
        }

        if ($facultyPatient && $dentistUser) {
            DentalConsultation::firstOrCreate(
                [
                    'patient_id'        => $facultyPatient->id,
                    'consultation_date' => $today,
                ],
                [
                    'created_by'          => $dentistUser->id,
                    'reason_for_visit'    => 'Annual dental checkup',
                    'dental_findings'     => 'Healthy gingiva, mild plaque on lower anterior lingual surfaces',
                    'diagnosis'           => 'Dental Examination & Cleaning',
                    'treatment_performed' => 'Oral prophylaxis, polishing',
                    'recommendations'     => 'Floss daily, follow up in 6 months',
                ]
            );
        }
    }
}
