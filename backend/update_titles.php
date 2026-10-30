<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

// Remove 'Prof.' from faculty_staff
$facultyUsers = User::where('role', 'faculty_staff')->get();
foreach ($facultyUsers as $user) {
    if ($user->title === 'Prof.') {
        $user->title = null;
        $user->save();
        echo "Updated Faculty User {$user->id}: removed 'Prof.' title.\n";
    }
}

// Add 'Nurse' to clinic_staff if empty
$nurseUsers = User::where('role', 'clinic_staff')->get();
foreach ($nurseUsers as $user) {
    if (empty($user->title)) {
        $user->title = 'Nurse';
        $user->save();
        echo "Updated Clinic Staff User {$user->id}: added 'Nurse' title.\n";
    }
}

// Ensure Dentist has 'Dr.'
$dentistUsers = User::where('role', 'dentist')->get();
foreach ($dentistUsers as $user) {
    if (empty($user->title)) {
        $user->title = 'Dr.';
        $user->save();
        echo "Updated Dentist User {$user->id}: added 'Dr.' title.\n";
    }
}

echo "Database updated.\n";
