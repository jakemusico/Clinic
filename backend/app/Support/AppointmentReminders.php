<?php

namespace App\Support;

use App\Models\Appointment;
use App\Models\ClinicService;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Appointment reminders (24h and 1h before a confirmed appointment).
 *
 * Two entry points share the same logic:
 *  - forAll()       — the `appointments:send-reminders` artisan command (for cron/scheduler setups)
 *  - forUser($user) — called from the notifications poll, throttled to ~once a minute per user,
 *                     so reminders are created inside a normal request with zero external setup
 *
 * Only 'confirmed' appointments are reminded (the enum has no 'approved' status; pending means
 * not yet confirmed). Cancelled/completed/no_show and past appointments are excluded by the
 * status + future-time filters. Times use the application timezone (Asia/Manila).
 *
 * Each reminder is claimed atomically (reminder_24h_sent_at / reminder_1h_sent_at set with a
 * conditional UPDATE), so concurrent requests, multiple users polling at once, and the artisan
 * command can never send the same reminder twice. Rescheduling clears both columns.
 */
final class AppointmentReminders
{
    /** Minimum seconds between reminder checks for one user on the poll path. */
    private const USER_CHECK_TTL = 60;

    /**
     * Create due reminders for appointments relevant to this user (as patient or as staff),
     * at most once per USER_CHECK_TTL seconds per user. Called on every notifications poll.
     */
    public static function forUser(User $user): void
    {
        if (! Cache::add("appt-reminders:user:{$user->id}", 1, self::USER_CHECK_TTL)) {
            return;
        }

        $now = now();
        $appointments = self::dueQuery($now)
            ->where(fn ($q) => $q
                ->where('staff_id', $user->id)
                ->orWhereHas('patient', fn ($p) => $p->where('user_id', $user->id)))
            ->get();

        foreach ($appointments as $appointment) {
            try {
                self::process($appointment);
            } catch (\Throwable $e) {
                Log::warning('Appointment reminder failed', [
                    'appointment_id' => $appointment->id,
                    'error'          => $e->getMessage(),
                ]);
            }
        }
    }

    /** All due reminders regardless of user — used by the artisan command. Returns reminders sent. */
    public static function forAll(): int
    {
        $sent = 0;

        foreach (self::dueQuery(now())->get() as $appointment) {
            try {
                $sent += self::process($appointment);
            } catch (\Throwable $e) {
                Log::warning('Appointment reminder failed', [
                    'appointment_id' => $appointment->id,
                    'error'          => $e->getMessage(),
                ]);
            }
        }

        return $sent;
    }

    /** Confirmed, still-upcoming appointments inside either reminder window. */
    private static function dueQuery(Carbon $now)
    {
        return Appointment::with(['patient.user', 'service', 'staff'])
            ->where('status', 'confirmed')
            ->where('scheduled_at', '>', $now)
            ->where(function ($q) use ($now) {
                // 24h window: the appointment is 23–24 hours away
                $q->whereBetween('scheduled_at', [$now->copy()->addHours(23), $now->copy()->addHours(24)])
                // 1h window: the appointment starts within the next hour
                  ->orWhereBetween('scheduled_at', [$now->copy(), $now->copy()->addHour()]);
            });
    }

    /** Send whichever reminders are due for one appointment. Returns patient reminders sent. */
    private static function process(Appointment $appointment): int
    {
        $sent = 0;
        $now = now();
        $when = Carbon::parse($appointment->scheduled_at);
        $serviceName = $appointment->service?->name ?? 'clinic';
        $dateTime = $when->format('M d, Y \a\t g:i A');

        $due24 = $appointment->reminder_24h_sent_at === null
            && $when->gte($now->copy()->addHours(23)) && $when->lte($now->copy()->addHours(24));
        $due1h = $appointment->reminder_1h_sent_at === null
            && $when->gte($now->copy()) && $when->lte($now->copy()->addHour());

        if ($due24 && self::claim($appointment, 'reminder_24h_sent_at')) {
            self::notifyOrRelease(
                $appointment->patient?->user,
                'Appointment Reminder',
                "Reminder: your {$serviceName} appointment is on {$dateTime}.",
                $appointment,
                'reminder_24h_sent_at'
            );
            self::bumpCounters($appointment->patient?->user_id);
            $sent++;
        }

        if ($due1h && self::claim($appointment, 'reminder_1h_sent_at')) {
            self::notifyOrRelease(
                $appointment->patient?->user,
                'Appointment Starting Soon',
                "Your {$serviceName} appointment is on {$dateTime} — about 1 hour away.",
                $appointment,
                'reminder_1h_sent_at'
            );
            self::bumpCounters($appointment->patient?->user_id);
            $sent++;

            // The assigned nurse/dentist gets the 1-hour heads-up too. A failure here must NOT
            // release the claim — the patient's reminder already went out and must not repeat.
            try {
                if ($appointment->staff) {
                    self::notify(
                        $appointment->staff,
                        'Upcoming Appointment',
                        'You have a ' . $serviceName . ' appointment with '
                            . ($appointment->patient?->user?->name ?? 'the patient')
                            . " on {$dateTime}.",
                        $appointment,
                        staff: true
                    );
                }
            } catch (\Throwable $e) {
                Log::warning('Staff reminder notification failed', [
                    'appointment_id' => $appointment->id,
                    'error'          => $e->getMessage(),
                ]);
            }
            self::bumpCounters($appointment->staff_id);
        }

        return $sent;
    }

    /**
     * Atomically mark the reminder as sent. Returns false when another process
     * already claimed it — the caller must then do nothing.
     */
    private static function claim(Appointment $appointment, string $column): bool
    {
        return Appointment::whereKey($appointment->id)
            ->whereNull($column)
            ->update([$column => now()]) === 1;
    }

    /** Create the notification (+ optional email); release the claim if it fails. */
    private static function notifyOrRelease(?User $user, string $title, string $message, Appointment $appointment, string $column, bool $staff = false): void
    {
        if (! $user) {
            return;
        }

        try {
            self::notify($user, $title, $message, $appointment, $staff);
        } catch (\Throwable $e) {
            // Give the claim back so the next check can retry instead of losing the reminder.
            Appointment::whereKey($appointment->id)->where($column, '!=', null)->update([$column => null]);
            throw $e;
        }
    }

    private static function notify(User $user, string $title, string $message, Appointment $appointment, bool $staff = false): void
    {
        $isDental = $appointment->service?->care_type === ClinicService::CARE_DENTAL;
        $actionUrl = $staff
            ? ($isDental ? '/dental/appointments' : '/clinic/appointments') . "?highlight={$appointment->id}"
            : "/appointments?highlight={$appointment->id}";

        Notification::create([
            'user_id'     => $user->id,
            'title'       => $title,
            'message'     => $message,
            'type'        => 'info',
            'target_type' => 'appointment',
            'target_id'   => $appointment->id,
            'action_url'  => $actionUrl,
        ]);

        self::sendEmail($user, $title, $message);
    }

    /** Email only when a real mail transport is configured (not the log/array drivers). */
    private static function sendEmail(User $user, string $title, string $message): void
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

    /** Header counters are cached per user; start a new version so the badge updates at once. */
    private static function bumpCounters(?int $userId): void
    {
        if ($userId) {
            CacheVersion::bump("counters:{$userId}");
        }
    }
}
