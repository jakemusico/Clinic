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

- **One request per dashboard.** `GET /api/dashboard/{admin|nurse|dentist|student}` returns the stats, charts, recent visits, alerts and calendar events together. Charts, stock levels and the student count are cached for 30-60 seconds; today's appointments and recent visits are always live.
- **One request for the header badges.** `GET /api/counters` returns the unread notifications (and the 5 newest), appointment requests and unread chat in a single call, polled every 45 seconds while the tab is visible.
- **Polling only when needed.** Nothing polls in a hidden tab (the staff heartbeat, every 60 s, is the only exception, because it reports "online"). An open chat panel polls every 7 seconds.
- **Indexes.** Migration `2026_11_05_000001_add_performance_indexes` indexes the dates, status and foreign-key columns the dashboards and lists filter on. It is safe to run on a database that already has some of them.

## Notes

- Never commit `.env` files. Use `.env.example` as the template.
- The seeder creates demo accounts with a default password. Change or remove them before any real deployment.
