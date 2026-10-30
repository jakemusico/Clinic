<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

$user1 = User::find(1);
if ($user1) {
    $user1->first_name = 'Admin';
    $user1->last_name = 'User';
    $user1->name = 'Admin User';
    $user1->save();
}

$user2 = User::find(2);
if ($user2) {
    $user2->first_name = 'Clinic';
    $user2->last_name = 'Staff';
    $user2->name = 'Clinic Staff';
    $user2->save();
}

$user4 = User::find(4);
if ($user4) {
    $user4->first_name = 'Maria';
    $user4->last_name = 'Santos';
    $user4->title = 'Prof.';
    $user4->name = 'Maria Santos';
    $user4->save();
}

$user5 = User::find(5);
if ($user5) {
    $user5->first_name = 'Jane';
    $user5->last_name = 'Doe';
    $user5->title = 'Dr.';
    $user5->name = 'Jane Doe';
    $user5->save();
}

$user6 = User::find(6);
if ($user6) {
    $user6->first_name = 'John';
    $user6->last_name = 'Smith';
    $user6->title = 'Prof.';
    $user6->name = 'John Smith';
    $user6->save();
}

\App\Models\InventoryItem::where('category', 'Equipment')->where('unit', 'unit')->update(['unit' => 'piece']);

echo "Fixed data.\n";
