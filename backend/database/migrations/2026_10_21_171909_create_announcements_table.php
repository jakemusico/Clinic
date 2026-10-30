<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Duplicate migration – kept to preserve batch history. Safe no-op.
return new class extends Migration
{
    public function up(): void
    {
        // The announcements table is already created by the sibling migration.
        // Nothing to do here.
    }

    public function down(): void
    {
        // Nothing to undo.
    }
};
