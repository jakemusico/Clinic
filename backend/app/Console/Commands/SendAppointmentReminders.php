<?php

namespace App\Console\Commands;

use App\Models\Appointment;
use App\Models\ClinicService;
use App\Models\Notification;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Sends appointment reminders: 24 hours and 1 hour before a confirmed appointment.
 *
 * Runs every minute via the scheduler (routes/console.php). Each reminder is stored
 * once — reminder_24h_sent_at / reminder_1h_sent_at on the appointment record when
 * it has been sent, and rescheduling clears both (see AppointmentController::reschedule).
 *
 * Only 'confirmed' appointments are reminded (the enum has no 'approved' status;
 * pending means not yet confirmed). Cancelled/completed/no_show and past
 * appointments are skipped by the status + future-time filters.
 */
class SendAppointmentReminders extends Command
{
    protected $signature = 'appointments:send-reminders';
    protected $description = 'Send 24-hour and 1-hour reminders for confirmed appointments';

    public function handle(): int
    {
        $now = now(); // application timezone: Asia/Manila

        $appointments = Appointment::with(['patient.user', 'service', 'staff'])
            ->where('status', 'confirmed')
            ->where('scheduled_at', '>', $now)
            ->where(function ($q) use ($now) {
                // 24h window: the appointment is 23–24 hours away
                $q->whereBetween('scheduled_at', [$now->copy()->addHours(23), $now->copy()->addHours(24)])
                // 1h window: the appointment starts within the next hour
                  ->orWhereBetween('scheduled_at', [$now->copy(), $now->copy()->addHour()]);
            })
            ->get();

        $sent = 0;

        foreach ($appointments as $appointment) {
            try {
                $when = Carbon::parse($appointment->scheduled_at);
                $sent += $this->process($appointment, $when, $now);
            } catch (\Throwable $e) {
                Log::warning('Appointment reminder failed', [
                    'appointment_id' => $appointment->id,
                    'error'          => $e->getMessage(),
                ]);
            }
        }

        if ($sent > 0) {
            $this->info("Sent {$sent} reminder(s).");
        }

        return self::SUCCESS;
    }

    private function process(Appointment $appointment, Carbon $when, Carbon $now): int
    {
        $sent = 0;
        $serviceName = $appointment->service?->name ?? 'clinic';
        $dateTime = $when->format('M d, Y \a\t g:i A');

        $due24 = $appointment->reminder_24h_sent_at === null
            && $when->gte($now->copy()->addHours(23)) && $when->lte($now->copy()->addHours(24));
        $due1h = $appointment->reminder_1h_sent_at === null
            && $when->gte($now->copy()) && $when->lte($now->copy()->addHour());

        if ($due24) {
            $this->notify(
                $appointment->patient?->user,
                'Appointment Reminder',
                "Reminder: your {$serviceName} appointment is on {$dateTime}.",
                $appointment
            );
            $this->markSent($appointment, 'reminder_24h_sent_at');
            $sent++;
        }

        if ($due1h) {
            $patientName = $appointment->patient?->user?->name ?? 'the patient';

            $this->notify(
                $appointment->patient?->user,
                'Appointment Starting Soon',
                "Your {$serviceName} appointment is on {$dateTime} — about 1 hour away.",
                $appointment
            );
            $this->markSent($appointment, 'reminder_1h_sent_at');
            $sent++;

            // The assigned nurse/dentist gets the 1-hour heads-up too.
            $this->notify(
                $appointment->staff,
                'Upcoming Appointment',
                "You have a {$serviceName} appointment with {$patientName} on {$dateTime}.",
                $appointment,
                staff: true
            );
        }

        return $sent;
    }

    private function notify(?\App\Models\User $user, string $title, string $message, Appointment $appointment, bool $staff = false): void
    {
        if (! $user) {
            return;
        }

        $isDental = $appointment->service?->care_type === ClinicService::CARE_DENTAL;
        $actionUrl = $staff
            ? ($isDental ? '/dental/appointments' : '/clinic/appointments') . "?highlight={$appointment->id}"
            : "/appointments?highlight={$appointment->id}";

        Notification::create([
            'user_id'    => $user->id,
            'title'      => $title,
            'message'    => $message,
            'type'       => 'info',
            'target_type' => 'appointment',
            'target_id'  => $appointment->id,
            'action_url' => $actionUrl,
        ]);

        $this->sendEmail($user, $title, $message);
    }

    /** Email only when a real mail transport is configured (not the log/array drivers). */
    private function sendEmail(\App\Models\User $user, string $title, string $message): void
    {
        if (in_array(config('mail.default'), ['log', 'array'], true) || ! $user->email) {
            return;
        }

        try {
            Mail::raw($message, function ($mail) use ($user, $title) {
                $mail->to($user->email)
                     ->subject("[{$title}] " . config('app.name'));
            });
        } catch (\Throwable $e) {
            Log::warning('Appointment reminder email failed', [
                'user_id' => $user->id,
                'error'   => $e->getMessage(),
            ]);
        }
    }

    private function markSent(Appointment $appointment, string $column): void
    {
        $appointment->{$column} = now();
        $appointment->save();
    }
}
