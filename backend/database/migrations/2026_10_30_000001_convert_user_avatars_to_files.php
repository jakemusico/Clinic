<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Profile photos used to be stored as base64 data URIs inside users.avatar
 * (longText), which overflowed MySQL's max_allowed_packet.
 *
 * This migration:
 *  1. converts any legacy base64 avatar into a file under
 *     storage/app/public/profile-photos and stores only the relative path
 *     (rows that cannot be converted are cleared);
 *  2. shrinks users.avatar to varchar(255), since it now holds a path;
 *  3. moves staff PRC license numbers that were saved in users.department
 *     into users.license_no (the column the Admin > User Management screen
 *     already uses).
 */
return new class extends Migration
{
    private const DIR = 'profile-photos';

    private const MIME_EXT = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    ];

    public function up(): void
    {
        if (! Schema::hasColumn('users', 'avatar')) {
            return;
        }

        $disk = Storage::disk('public');
        $disk->makeDirectory(self::DIR);

        // 1. Convert / clear legacy values (small chunks: rows may be megabytes each).
        DB::table('users')
            ->whereNotNull('avatar')
            ->where('avatar', '!=', '')
            ->orderBy('id')
            ->select('id')
            ->chunkById(20, function ($rows) use ($disk) {
                foreach ($rows as $row) {
                    $avatar = DB::table('users')->where('id', $row->id)->value('avatar');
                    DB::table('users')->where('id', $row->id)->update([
                        'avatar' => $this->convert((int) $row->id, (string) $avatar, $disk),
                    ]);
                }
            });

        // 2. The column only holds a short relative path from now on.
        Schema::table('users', function ($table) {
            $table->string('avatar', 255)->nullable()->change();
        });

        // 3. PRC license numbers belong in license_no, not department.
        if (Schema::hasColumn('users', 'license_no') && Schema::hasColumn('users', 'department')) {
            DB::table('users')
                ->whereIn('role', ['clinic_staff', 'dentist'])
                ->where(fn ($q) => $q->whereNull('license_no')->orWhere('license_no', ''))
                ->whereNotNull('department')
                ->get(['id', 'department'])
                ->each(function ($u) {
                    // Only values that look like a license number (e.g. "PRC-1234567", "1234567").
                    if (preg_match('/^(PRC[\s-]?)?\d[\d-]{3,}$/i', trim($u->department))) {
                        DB::table('users')->where('id', $u->id)->update([
                            'license_no' => trim($u->department),
                            'department' => null,
                        ]);
                    }
                });
        }
    }

    public function down(): void
    {
        // Photo files are kept on disk; only the column type is restored.
        Schema::table('users', function ($table) {
            $table->longText('avatar')->nullable()->change();
        });
    }

    /**
     * Return the relative file path for a legacy value, or null if it can't be kept.
     */
    private function convert(int $userId, string $value, $disk): ?string
    {
        $value = trim($value);

        // Already a stored path.
        if (str_starts_with($value, self::DIR . '/') && ! str_contains($value, '..')) {
            return $value;
        }

        // Legacy base64 data URI.
        if (preg_match('#^data:image/[a-z0-9.+-]+;base64,(.+)$#is', $value, $m)) {
            $binary = base64_decode($m[1], true);
            if ($binary !== false && $binary !== '') {
                $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($binary);
                if (isset(self::MIME_EXT[$mime])) {
                    $path = self::DIR . '/' . sprintf('user%d_%s.%s', $userId, Str::uuid(), self::MIME_EXT[$mime]);
                    if ($disk->put($path, $binary)) {
                        return $path;
                    }
                }
            }
        }

        Log::warning("Cleared unusable legacy avatar value for user #{$userId} during migration.");

        return null;
    }
};
