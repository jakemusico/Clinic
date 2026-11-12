# FSUU Smart Campus Clinic System

A web-based clinic management system for a university campus. It covers appointments, medical and dental records, inventory, announcements, chat and reports.

## Tech Stack

- **Frontend:** React (Vite)
- **Backend:** Laravel (REST API)
- **Database:** MySQL
- **Authentication:** Laravel Sanctum

## Project Structure

```
clinic/
├── backend/    # Laravel API
└── frontend/   # React app (Vite)
```

## Requirements

- PHP 8.2+ and Composer
- Node.js 18+ and npm
- MySQL 8+ (or MariaDB)

## Setup

### Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

Create an empty MySQL database (default name `clinic_db`) and set `DB_USERNAME` / `DB_PASSWORD` in `backend/.env`. Then run:

```bash
php artisan key:generate
php artisan migrate --seed
php artisan storage:link    # makes uploaded profile photos reachable at /storage/...
php artisan serve
```

> **Back up `APP_KEY`.** Sensitive clinic fields (diagnoses, treatments, notes, etc.) are encrypted in the database using `APP_KEY` from `backend/.env`. If the key is lost or changed, that data becomes permanently unreadable. Keep a secure copy of the key (e.g. in a password manager) before deploying or migrating servers. After pulling this change on an existing install, run `php artisan migrate && php artisan data:encrypt-existing` once to encrypt rows stored before encryption was enabled.

The API runs at http://localhost:8000.

### Frontend (React)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app runs at http://localhost:5173. The Vite dev server proxies `/api` requests to http://localhost:8000.

## Deploying to production

Do these steps on the server, in this order. Run the backend commands in `backend/` and the frontend commands in `frontend/`.

### 1. Backend

```bash
composer install --no-dev --optimize-autoloader     # no dev packages, class map autoloader
cp .env.production.example .env                      # first deploy only, then edit the values
php artisan key:generate                             # first deploy only
php artisan migrate --force                          # includes the performance indexes
php artisan storage:link                             # first deploy only

# Cache the framework's own work (config, events, routes, views) in one command:
php artisan optimize
# ...which is the same as: config:cache, event:cache, route:cache, view:cache
```

Check these in `backend/.env` before running `php artisan optimize`:

- `APP_ENV=production` and **`APP_DEBUG=false`** (debug mode exposes stack traces and is slower).
- `APP_KEY` must be the same key the database was encrypted with — losing it makes encrypted consultation data unreadable. Back it up.
- `LOG_LEVEL=warning` (the template sets this).
- `CACHE_STORE=file` for one server, `redis` for several.

After `config:cache`, Laravel no longer reads `.env`. Whenever you change `.env` or any route, run `php artisan optimize:clear && php artisan optimize` again. Queue workers and PHP-FPM must be restarted/reloaded after a deploy so they pick up the new code.

Enable OPcache in the production `php.ini` (PHP then keeps compiled code in memory instead of re-parsing the framework on every request):

```ini
opcache.enable=1
opcache.memory_consumption=192
opcache.max_accelerated_files=20000
opcache.validate_timestamps=0     ; reload PHP-FPM after each deploy
```

### 2. Frontend

```bash
npm ci
npm run build          # writes the optimised, code-split app to frontend/dist
```

Serve `frontend/dist` as static files. Pages are split into small chunks that load on demand (the charts, calendar and photo cropper only download when needed), so keep the whole `dist/assets` folder.

### 3. Web server: gzip and caching

Text assets (JS, CSS) and the JSON API shrink to roughly a third of their size with gzip (the main app bundle goes from about 293 kB to 88 kB). nginx example:

```nginx
server {
    server_name clinic.example.edu.ph;
    root /var/www/clinic/frontend/dist;
    index index.html;

    # gzip for the app and the API responses
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_vary on;
    gzip_types text/plain text/css text/javascript application/javascript application/json image/svg+xml;

    # Built files have a hash in their name, so they can be cached for a year
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Single-page app: unknown paths go to index.html
    location / {
        try_files $uri /index.html;
    }

    # Laravel API and uploaded photos
    location /api/     { proxy_pass http://127.0.0.1:8000; }   # or fastcgi_pass to PHP-FPM with root /var/www/clinic/backend/public
    location /storage/ { proxy_pass http://127.0.0.1:8000; }
}
```

Apache: enable `mod_deflate` and `mod_expires`, then add `AddOutputFilterByType DEFLATE text/css application/javascript application/json image/svg+xml` and `ExpiresByType application/javascript "access plus 1 year"` for `/assets`.

Optional: pre-compress once at build time (`gzip -k -9 dist/assets/*.js dist/assets/*.css`) and set `gzip_static on;` in nginx so the server does not compress on every request.

### 4. Check it

```bash
php artisan about              # Environment: production, Debug Mode: OFF, Cache: config/routes/views CACHED
php artisan route:list | head
curl -s -o /dev/null -w "%{size_download} bytes, %{time_total}s\n" -H "Accept-Encoding: gzip" https://clinic.example.edu.ph/assets/<index-file>.js
```

### How the app keeps its load light

- **One request per dashboard.** `GET /api/dashboard/{admin|nurse|dentist|student}` returns the stats, charts, recent visits, alerts and calendar events together. Charts, stock levels and the student count are cached for 1-5 minutes and refreshed at once when the data behind them changes (see Caching below); today's appointments and recent visits are always live.
- **One request for the header badges.** `GET /api/counters` returns the unread notifications (and the 5 newest), appointment requests and unread chat in a single call, polled every 45 seconds while the tab is visible.
- **Polling only when needed.** Nothing polls in a hidden tab (the staff heartbeat, every 60 s, is the only exception, because it reports "online"). An open chat panel polls every 7 seconds.
- **Indexes.** Migration `2026_11_05_000001_add_performance_indexes` indexes the dates, status and foreign-key columns the dashboards and lists filter on. It is safe to run on a database that already has some of them.

### 5. Scheduler (required for the inventory alerts)
Low-stock and expiry alerts for the admins are created by the `inventory:sync-alerts` command, which Laravel's scheduler runs every 5 minutes. They are also created within a minute of any stock change. The polled `GET /api/counters` and `GET /api/notifications` no longer create them. Without the scheduler, alerts that depend only on time (a batch reaching its expiry date overnight) appear only after the next stock change.
```bash
php artisan schedule:work      # development: leave it running in a terminal
```
Production: add one cron entry (`crontab -e`) that runs every minute:
```
* * * * * cd /var/www/clinic/backend && php artisan schedule:run >> /dev/null 2>&1
```
On Windows, create a Task Scheduler task that runs `php artisan schedule:run` in `backend/` every minute. To run the sync once by hand: `php artisan inventory:sync-alerts`.
### Rate limits
Requests over a limit get HTTP 429 and the message "Too many requests. Please wait N seconds and try again." (the `Retry-After` header and a `retry_after` field carry the wait). Limits per minute: sign in 10 per email and address (60 per address), register 5 per address, chatbot question 30 per user, chat message 20 per user, book an appointment 10 per user, broadcast announcement 5 per user. They are defined in `AppServiceProvider::configureRateLimiting()` and attached in `routes/api.php` as `throttle:<name>`. Behind a proxy, set `TRUSTED_PROXIES` so the limits use the visitor's address and not the proxy's.
### Caching
Cached API data uses versioned keys (`App\Support\CacheVersion`), not cache tags, so the `file` driver works. Saving or deleting the underlying rows starts a new version, so a change shows up at once: dashboard charts (60 s), stock snapshot (60 s), registered-student count (5 min), clinic services, sections, settings and staff list (5-10 min), calendar events and announcements per audience (60 s), header counters per user (15 s). Patient records, vitals, consultation details, chat messages, slot availability and every stock read that decides a dispense are never cached.
## Notes

- Never commit `.env` files. Use `.env.example` as the template.
- The seeder creates demo accounts with a default password. Change or remove them before any real deployment.
