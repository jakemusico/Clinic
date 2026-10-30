<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

$users = User::all();

foreach ($users as $user) {
    echo "ID: {$user->id}, Name: {$user->name}, First: {$user->first_name}, Last: {$user->last_name}, Role: {$user->role}, Title: {$user->title}\n";
}
