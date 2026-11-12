<?php

namespace App\Console\Commands;

use App\Support\CacheVersion;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * One-time migration helper: encrypt plaintext values that existed before the
 * `encrypted` casts were added. Safe to rerun — rows already holding Laravel
 * ciphertext are detected by attempting a decrypt and skipped.
 *
 * Reads raw columns via the query builder (no Eloquent casts), so plaintext
 * rows never trigger a decrypt exception, and writes go straight to the
 * database so values are never double-encrypted.
 */
class EncryptExistingData extends Command
{
    protected $signature = 'data:encrypt-existing';
    protected $description = 'Encrypt plaintext values in columns that now use the encrypted cast';

    private const MAP = [
        'clinic_records' => [
            'diagnosis', 'treatment', 'prescription', 'remarks', 'chief_complaint',
            'symptoms', 'assessment', 'recommendation', 'notes',
        ],
        'dental_consultations' => [
            'reason_for_visit', 'dental_findings', 'diagnosis', 'treatment_performed',
            'recommendations', 'notes', 'staff_notes',
        ],
        'dental_chart_teeth' => ['notes'],
    ];

    public function handle(): int
    {
        $encrypted = 0;
        $scanned = 0;

        foreach (self::MAP as $table => $columns) {
            DB::table($table)->select(array_merge(['id'], $columns))
                ->orderBy('id')
                ->chunk(200, function ($rows) use ($table, $columns, &$encrypted, &$scanned) {
                    foreach ($rows as $row) {
                        $updates = [];
                        foreach ($columns as $col) {
                            $value = $row->{$col} ?? null;
                            if (! is_string($value) || $value === '') {
                                continue;
                            }
                            $scanned++;
                            if ($this->isEncrypted($value)) {
                                continue;
                            }
                            $updates[$col] = Crypt::encryptString($value);
                            $encrypted++;
                        }
                        if ($updates) {
                            DB::table($table)->where('id', $row->id)->update($updates);
                        }
                    }
                });
        }

        // Raw updates bypass model events, so invalidate report caches manually.
        if ($encrypted > 0) {
            CacheVersion::bump('reports');
        }

        $this->info("Scanned {$scanned} value(s); encrypted {$encrypted} value(s).");
        return self::SUCCESS;
    }

    /** True when the stored value is already Laravel ciphertext. */
    private function isEncrypted(string $value): bool
    {
        try {
            Crypt::decryptString($value);
            return true;
        } catch (\Throwable) {
            return false;
        }
    }
}
