<?php

use Illuminate\Support\Facades\Route;

// Route::view (not a closure) so `php artisan route:cache` works in production
Route::view('/', 'welcome');
