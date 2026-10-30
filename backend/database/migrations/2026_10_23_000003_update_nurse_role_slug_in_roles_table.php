<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('roles')->where('id', 2)->update([
            'slug' => 'clinic_staff',
            'name' => 'Nurse',
        ]);

        DB::table('users')->where('id', 2)->update([
            'role' => 'clinic_staff',
            'role_id' => 2,
        ]);
    }

    public function down(): void
    {
        DB::table('roles')->where('id', 2)->update([
            'slug' => 'nurse',
        ]);
    }
};
