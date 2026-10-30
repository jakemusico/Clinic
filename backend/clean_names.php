<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

$users = User::all();

foreach ($users as $user) {
    $title = null;
    $firstName = $user->first_name;
    $name = $user->name;

    if ($user->id == 3) {
        $user->first_name = 'Juan';
        $user->last_name = 'Dela Cruz';
        // recalculate full name
        $name = trim($user->first_name . ' ' . ($user->middle_name ? $user->middle_name . ' ' : '') . $user->last_name);
        $user->name = $name;
    }

    if (preg_match('/^(Dr\.|Prof\.)\s*(.*)$/i', $user->first_name, $matches)) {
        $title = $matches[1];
        $user->first_name = $matches[2];
    }
    
    // Also check name just in case
    if (preg_match('/^(Dr\.|Prof\.)\s*(.*)$/i', $user->name, $matches)) {
        if (!$title) {
            $title = $matches[1];
        }
        $user->name = trim($user->first_name . ' ' . ($user->middle_name ? $user->middle_name . ' ' : '') . $user->last_name);
    }
    
    // If dentist, set to Dr., if faculty, set to Prof. (default behavior if no title is present)
    if (!$title) {
        if ($user->role === 'dentist') {
            $title = 'Dr.';
        } elseif ($user->role === 'faculty_staff') {
            // $title = 'Prof.'; // Don't auto-assign Prof. retroactively, wait, the requirement says "Dentist defaults to Dr., Faculty/Staff defaults to Prof." Let's do it for newly created users, but maybe for existing too? I will just clean up existing "Dr." and "Prof.".
        }
    }

    $user->title = $title;
    
    // Update name if first_name was modified
    $user->name = trim($user->first_name . ' ' . ($user->middle_name ? $user->middle_name . ' ' : '') . $user->last_name);

    $user->save();
    
    echo "Updated User {$user->id}: Title={$user->title}, First={$user->first_name}, Last={$user->last_name}, Name={$user->name}\n";
}
