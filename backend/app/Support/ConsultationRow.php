<?php

namespace App\Support;

use App\Models\ClinicRecord;
use App\Models\DentalConsultation;
use Carbon\CarbonInterface;

/**
 * One row of consultation data for the dashboards (Recent Visits) and the reports.
 *
 * The Consultation Logs pages read `service_name` and the visit / consultation date straight
 * from the record. This class reads the very same two fields, so a dashboard can never show a
 * different service or date than the logs. There is deliberately NO fallback label here:
 * a missing service stays null and the frontend shows "Not specified".
 */
final class ConsultationRow
{
    /** The service saved on the record, or null when none was saved. */
    public static function serviceName(ClinicRecord|DentalConsultation $record): ?string
    {
        $name = trim((string) $record->service_name);

        return $name !== '' ? $name : null;
    }

    /**
     * The calendar day of the consultation as Y-m-d (Asia/Manila), the day chosen in the form.
     * Only records with no date at all fall back to the day they were created.
     */
    public static function day(ClinicRecord|DentalConsultation $record): string
    {
        $date = $record instanceof ClinicRecord ? $record->visit_date : $record->consultation_date;
        $date ??= $record->created_at;

        return $date instanceof CarbonInterface ? $date->toDateString() : '';
    }

    /** "Nov 4, 2026", or the placeholder when there is no date. */
    public static function displayDate(string $day): string
    {
        return $day !== '' ? \Carbon\Carbon::parse($day)->format('M j, Y') : Placeholder::EMPTY;
    }

    public static function medical(ClinicRecord $r): array
    {
        $u = $r->patient?->user;
        $day = self::day($r);

        return [
            'id'                  => "med-{$r->id}",
            'record_id'           => $r->id,
            'type'                => 'medical',
            'patient_id'          => $r->patient_id,
            'patient_user_id'     => $u?->id,
            'patient_name'        => $u?->name ?? 'Walk-in Patient',
            'student_name'        => $u?->name ?? 'Walk-in Patient',
            'student_id'          => $u?->student_id ?? ($u?->employee_id ?? Placeholder::EMPTY),
            'role'                => $u?->role ?? 'student',
            'service'             => self::serviceName($r),
            'complaint_category'  => $r->complaint_category ?: 'General Consultation',
            'complaint_diagnosis' => $r->complaint_category ?: ($r->chief_complaint ?: ($r->diagnosis ?: 'General Consultation')),
            'diagnosis'           => $r->diagnosis ?: Placeholder::EMPTY,
            'treatment'           => $r->treatment ?: Placeholder::EMPTY,
            'status'              => 'Completed',
            'attending_staff'     => $r->createdBy?->name ?? 'Clinic Nurse',
            'date'                => self::displayDate($day),
            'raw_date'            => $day,
            'created_at'          => $r->created_at?->toISOString(),
        ];
    }

    public static function dental(DentalConsultation $c): array
    {
        $u = $c->patient?->user;
        $day = self::day($c);

        return [
            'id'                  => "dent-{$c->id}",
            'record_id'           => $c->id,
            'type'                => 'dental',
            'patient_id'          => $c->patient_id,
            'patient_user_id'     => $u?->id,
            'patient_name'        => $u?->name ?? 'Dental Patient',
            'student_name'        => $u?->name ?? 'Dental Patient',
            'student_id'          => $u?->student_id ?? ($u?->employee_id ?? Placeholder::EMPTY),
            'role'                => $u?->role ?? 'student',
            'service'             => self::serviceName($c),
            'complaint_category'  => $c->complaint_category ?: 'Dental Examination',
            'complaint_diagnosis' => $c->complaint_category ?: ($c->reason_for_visit ?: ($c->diagnosis ?: 'Dental Examination')),
            'diagnosis'           => $c->diagnosis ?: Placeholder::EMPTY,
            'treatment'           => $c->treatment_performed ?: Placeholder::EMPTY,
            'status'              => 'Completed',
            'attending_staff'     => $c->dentist?->name ?? 'Dentist',
            'date'                => self::displayDate($day),
            'raw_date'            => $day,
            'created_at'          => $c->created_at?->toISOString(),
        ];
    }
}
