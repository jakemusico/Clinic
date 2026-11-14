<?php

namespace App\Providers;

use App\Http\Controllers\Api\InventoryController;
use App\Models\Announcement;
use App\Models\Appointment;
use App\Models\CalendarEvent;
use App\Models\ClinicRecord;
use App\Models\ClinicService;
use App\Models\DentalConsultation;
use App\Models\InventoryBatch;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Models\Message;
use App\Models\Notification;
use App\Models\Section;
use App\Models\SystemSetting;
use App\Models\User;
use App\Support\CacheVersion;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Force HTTPS only in production — local XAMPP dev stays on plain http.
        if (app()->environment('production')) {
            URL::forceScheme('https');
        }

        $this->configureRateLimiting();
        $this->bumpCacheVersionsOnChange();
        $this->syncInventoryAlertsOnStockChange();
    }

    /**
     * Named limiters, used as `throttle:<name>` on the routes (routes/api.php).
     * A request over the limit gets HTTP 429 with a readable message (see bootstrap/app.php).
     * Per user for signed-in actions, per IP (and email) for the public ones.
     */
    private function configureRateLimiting(): void
    {
        $user = fn (Request $r) => 'user:' . ($r->user()?->id ?? $r->ip());

        // Sign in: 10 tries a minute for one email from one address, and 60 from one address overall
        RateLimiter::for('login', fn (Request $r) => [
            Limit::perMinute(10)->by('login|' . $r->ip() . '|' . strtolower((string) $r->input('email'))),
            Limit::perMinute(60)->by('login-ip|' . $r->ip()),
        ]);

        RateLimiter::for('register', fn (Request $r) => Limit::perMinute(5)->by('register|' . $r->ip()));

        // Google OAuth start/callback/complete — browsers bounce through these a few times
        RateLimiter::for('oauth', fn (Request $r) => Limit::perMinute(20)->by('oauth|' . $r->ip()));

        // Chatbot: every question scans the FAQs and writes a log row
        RateLimiter::for('chatbot', fn (Request $r) => Limit::perMinute(30)->by('chatbot|' . $user($r)));

        // Live chat: send a message
        RateLimiter::for('chat-send', fn (Request $r) => Limit::perMinute(20)->by('chat-send|' . $user($r)));

        RateLimiter::for('booking', fn (Request $r) => Limit::perMinute(10)->by('booking|' . $user($r)));

        // Broadcast announcements notify every user: very few per minute is plenty
        RateLimiter::for('announce', fn (Request $r) => Limit::perMinute(5)->by('announce|' . $user($r)));
    }

    /**
     * Cached data is keyed by a version number per group (see App\Support\CacheVersion). When the data
     * behind a group is saved, updated or deleted, the group gets a new version and the next request
     * rebuilds its cache from fresh data. Nothing cached is ever served after a change that affects it.
     */
    private function bumpCacheVersionsOnChange(): void
    {
        $bump = function (string $group, array $models) {
            foreach ($models as $model) {
                $model::saved(fn () => CacheVersion::bump($group));
                $model::deleted(fn () => CacheVersion::bump($group));
            }
        };

        // Dashboard charts and symptoms (consultations)
        $bump('dashboard', [ClinicRecord::class, DentalConsultation::class]);

        // Stock snapshot and alert counts
        $bump('stock', [InventoryTransaction::class, InventoryBatch::class, InventoryItem::class]);

        // Reference data
        $bump('services', [ClinicService::class]);
        $bump('sections', [Section::class]);
        $bump('settings', [SystemSetting::class]);
        $bump('calendar', [CalendarEvent::class]);
        $bump('announcements', [Announcement::class]);

        // /api/counters (cached 15 s per user): refresh it when what it counts changes
        Notification::saved(fn (Notification $n) => CacheVersion::bump("counters:{$n->user_id}"));
        Notification::deleted(fn (Notification $n) => CacheVersion::bump("counters:{$n->user_id}"));
        Message::saved(fn () => CacheVersion::bump('counters-chat'));
        Message::deleted(fn () => CacheVersion::bump('counters-chat'));
        Appointment::saved(fn () => CacheVersion::bump('counters-appointments'));
        Appointment::deleted(fn () => CacheVersion::bump('counters-appointments'));

        // Registered-student count and staff lists: an account is created, (de)activated, changes role, or is deleted
        User::created(fn () => CacheVersion::bump('users'));
        User::deleted(fn () => CacheVersion::bump('users'));
        User::updated(function (User $user) {
            if ($user->wasChanged(['is_active', 'role_id', 'first_name', 'middle_name', 'last_name', 'suffix', 'title', 'avatar'])) {
                CacheVersion::bump('users');
            }
        });
    }

    /**
     * Low-stock / expiry alerts for the admins used to be generated by the polled GET /api/counters.
     * They are now generated (1) by the scheduler (`inventory:sync-alerts`, every 5 minutes, see
     * routes/console.php) and (2) right after stock changes, here: after the response has been sent,
     * and at most once a minute however many rows change.
     */
    private function syncInventoryAlertsOnStockChange(): void
    {
        $queue = function () {
            if (app()->runningInConsole() && ! app()->runningUnitTests()) {
                return;   // seeders, imports and artisan commands: the scheduler covers them
            }
            if (! Cache::add('inventory:alert-sync-queued', 1, 60)) {
                return;
            }
            dispatch(fn () => InventoryController::checkAlertsAndNotifyAdmins())->afterResponse();
        };

        InventoryTransaction::created($queue);
        InventoryBatch::created($queue);
    }
}
