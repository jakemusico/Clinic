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

## Notes

- Never commit `.env` files. Use `.env.example` as the template.
- The seeder creates demo accounts with a default password. Change or remove them before any real deployment.
