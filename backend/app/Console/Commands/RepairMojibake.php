<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One-time repair for text that was stored with broken characters ("mojibake"), for example an
 * em dash that turned into three odd characters. That happens when UTF-8 text is read as
 * Windows-1252 and saved again as UTF-8.
 *
 *   php artisan text:repair-mojibake                  dry run: prints the affected row counts only
 *   php artisan text:repair-mojibake --apply          backs the affected rows up, then repairs them
 *   php artisan text:repair-mojibake --restore=FILE   puts the backed-up values back
 *
 * Only well-formed sequences are touched (a UTF-8 lead byte written as a Latin-1/Windows-1252
 * character, followed by the exact characters that spell its continuation bytes), so correct
 * text is never changed.
 */
class RepairMojibake extends Command
{
    protected $signature = 'text:repair-mojibake
                            {--apply : Repair the rows (a backup file is written first)}
                            {--restore= : Restore the original values from a backup file}';

    protected $description = 'Find (and with --apply, repair) broken characters (mojibake) in text columns';

    /** Framework tables with no user text. */
    private const SKIP_TABLES = [
        'migrations', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs',
        'sessions', 'password_reset_tokens', 'personal_access_tokens',
    ];

    /** Audit trail: history is kept as it was written. */
    private const AUDIT_TABLES = ['audit_logs'];

    private const TEXT_TYPES = ['char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext', 'json'];

    /** Windows-1252 characters in 0x80-0x9F  =>  byte */
    private const CP1252 = [
        0x20AC => 0x80, 0x201A => 0x82, 0x0192 => 0x83, 0x201E => 0x84, 0x2026 => 0x85, 0x2020 => 0x86,
        0x2021 => 0x87, 0x02C6 => 0x88, 0x2030 => 0x89, 0x0160 => 0x8A, 0x2039 => 0x8B, 0x0152 => 0x8C,
        0x017D => 0x8E, 0x2018 => 0x91, 0x2019 => 0x92, 0x201C => 0x93, 0x201D => 0x94, 0x2022 => 0x95,
        0x2013 => 0x96, 0x2014 => 0x97, 0x02DC => 0x98, 0x2122 => 0x99, 0x0161 => 0x9A, 0x203A => 0x9B,
        0x0153 => 0x9C, 0x017E => 0x9E, 0x0178 => 0x9F,
    ];

    public function handle(): int
    {
        if ($file = $this->option('restore')) {
            return $this->restore($file);
        }

        $apply = (bool) $this->option('apply');
        $found = $this->scan();   // [ ['table','pk','pk_value','column','before','after'], ... ]

        $this->newLine();
        if (empty($found)) {
            $this->info('No broken characters found in the database. Nothing to repair.');
            return self::SUCCESS;
        }

        $perColumn = [];
        $rows = [];
        foreach ($found as $f) {
            $perColumn["{$f['table']}.{$f['column']}"] = ($perColumn["{$f['table']}.{$f['column']}"] ?? 0) + 1;
            $rows["{$f['table']}#{$f['pk_value']}"] = true;
        }
        $this->table(['Column', 'Affected rows'], collect($perColumn)->map(fn ($n, $c) => [$c, $n])->values()->all());
        $this->warn(count($rows).' row(s) / '.count($found).' value(s) affected.');
        foreach (array_slice($found, 0, 5) as $f) {
            $this->line(sprintf('  e.g. %s.%s #%s: %s  ->  %s', $f['table'], $f['column'], $f['pk_value'],
                $this->preview($f['before']), $this->preview($f['after'])));
        }

        if (! $apply) {
            $this->newLine();
            $this->info('Dry run only. Re-run with --apply to back the rows up and repair them.');
            return self::SUCCESS;
        }

        $dir = storage_path('app/mojibake-backups');
        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $path = $dir.DIRECTORY_SEPARATOR.'mojibake-'.date('Ymd-His').'.json';
        $json = json_encode([
            'created_at' => now()->toDateTimeString(),
            'database'   => DB::getDatabaseName(),
            'rows'       => $found,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($json === false || file_put_contents($path, $json) === false) {
            $this->error('Could not write the backup file. Nothing was changed.');
            return self::FAILURE;
        }
        $this->info("Backup written: {$path}");

        DB::transaction(function () use ($found) {
            foreach ($found as $f) {
                DB::table($f['table'])->where($f['pk'], $f['pk_value'])->update([$f['column'] => $f['after']]);
            }
        });

        $this->info(count($found).' value(s) repaired. To undo: php artisan text:repair-mojibake --restore="'.$path.'"');
        return self::SUCCESS;
    }

    // ── Scan ─────────────────────────────────────────────────────────────────

    private function scan(): array
    {
        $found = [];
        $auditCount = 0;

        $seen = [];
        foreach (Schema::getTables() as $t) {
            $table = $t['name'];
            if (isset($seen[$table]) || in_array($table, self::SKIP_TABLES, true)) {
                continue;
            }
            $seen[$table] = true;
            $isAudit = in_array($table, self::AUDIT_TABLES, true);

            $textCols = [];
            foreach (Schema::getColumns($table) as $c) {
                if (in_array(strtolower($c['type_name']), self::TEXT_TYPES, true)) {
                    $textCols[$c['name']] = strtolower($c['type_name']);
                }
            }
            if (! $textCols) {
                continue;
            }

            $pk = null;
            foreach (Schema::getIndexes($table) as $idx) {
                if (! empty($idx['primary']) && count($idx['columns']) === 1) {
                    $pk = $idx['columns'][0];
                }
            }
            if ($pk === null) {
                $this->warn("  skipped {$table}: no single-column primary key");
                continue;
            }

            DB::table($table)->select(array_merge([$pk], array_keys($textCols)))
                ->orderBy($pk)
                ->chunk(500, function ($chunk) use (&$found, &$auditCount, $table, $pk, $textCols, $isAudit) {
                    foreach ($chunk as $row) {
                        foreach ($textCols as $col => $type) {
                            $value = $row->{$col};
                            if (! is_string($value) || $value === '') {
                                continue;
                            }
                            // MariaDB stores JSON columns as plain text, so look at the content, not the type
                            $isJson = $type === 'json' || in_array($value[0], ['{', '['], true);
                            $fixed = $isJson ? $this->repairJson($value) : $this->repairString($value);
                            if ($fixed !== null && $fixed !== $value) {
                                if ($isAudit) {
                                    $auditCount++;
                                    continue;
                                }
                                $found[] = [
                                    'table' => $table, 'pk' => $pk, 'pk_value' => $row->{$pk},
                                    'column' => $col, 'before' => $value, 'after' => $fixed,
                                ];
                            }
                        }
                    }
                });
        }

        if ($auditCount > 0) {
            $this->line("  note: {$auditCount} value(s) in the audit history contain broken characters; they are left as written.");
        }

        return $found;
    }

    // ── Restore ──────────────────────────────────────────────────────────────

    private function restore(string $file): int
    {
        if (! is_file($file)) {
            $this->error("Backup file not found: {$file}");
            return self::FAILURE;
        }
        $data = json_decode(file_get_contents($file), true);
        if (! is_array($data) || empty($data['rows'])) {
            $this->error('The file is not a valid backup.');
            return self::FAILURE;
        }

        $restored = 0;
        $skipped = 0;
        DB::transaction(function () use ($data, &$restored, &$skipped) {
            foreach ($data['rows'] as $r) {
                // only put the old value back when the row still holds the repaired value
                $n = DB::table($r['table'])
                    ->where($r['pk'], $r['pk_value'])
                    ->where($r['column'], $r['after'])
                    ->update([$r['column'] => $r['before']]);
                $n ? $restored++ : $skipped++;
            }
        });

        $this->info("Restored {$restored} value(s); {$skipped} skipped (changed since the repair).");
        return self::SUCCESS;
    }

    // ── Repair logic ─────────────────────────────────────────────────────────

    private function repairJson(string $json): ?string
    {
        $data = json_decode($json, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return $this->repairString($json);
        }
        $changed = false;
        $walk = function ($v) use (&$walk, &$changed) {
            if (is_string($v)) {
                $r = $this->repairString($v);
                if ($r !== $v) {
                    $changed = true;
                }
                return $r;
            }
            if (is_array($v)) {
                return array_map($walk, $v);
            }
            return $v;
        };
        $out = $walk($data);
        if (! $changed) {
            return $json;
        }

        // keep the style the value was written in (Laravel escapes non-ASCII as \uXXXX)
        $flags = str_contains($json, '\\u') ? 0 : JSON_UNESCAPED_UNICODE;
        if (! str_contains($json, '\\/')) {
            $flags |= JSON_UNESCAPED_SLASHES;
        }

        return json_encode($out, $flags);
    }

    /** Repairs every broken sequence in $s (up to 3 layers of double encoding). */
    private function repairString(string $s): string
    {
        for ($pass = 0; $pass < 3; $pass++) {
            if (! preg_match('/[\x{00C2}-\x{00F4}]/u', $s)) {
                return $s;
            }
            $next = $this->repairOnce($s);
            if ($next === $s) {
                return $s;
            }
            $s = $next;
        }

        return $s;
    }

    private function repairOnce(string $s): string
    {
        $chars = preg_split('//u', $s, -1, PREG_SPLIT_NO_EMPTY);
        if ($chars === false) {
            return $s;   // not valid UTF-8: leave untouched
        }
        $out = '';
        $n = count($chars);
        for ($i = 0; $i < $n;) {
            $b0 = $this->toByte(mb_ord($chars[$i], 'UTF-8'));
            if ($b0 >= 0xC2 && $b0 <= 0xF4) {
                $need = $b0 >= 0xF0 ? 3 : ($b0 >= 0xE0 ? 2 : 1);
                $bytes = [$b0];
                $j = $i + 1;
                while (count($bytes) <= $need && $j < $n) {
                    $b = $this->toByte(mb_ord($chars[$j], 'UTF-8'));
                    if ($b >= 0x80 && $b <= 0xBF) {
                        $bytes[] = $b;
                        $j++;
                    } else {
                        break;
                    }
                }
                if (count($bytes) === $need + 1) {
                    $raw = pack('C*', ...$bytes);
                    if (mb_check_encoding($raw, 'UTF-8')) {
                        $out .= $raw;
                        $i = $j;
                        continue;
                    }
                }
            }
            $out .= $chars[$i];
            $i++;
        }

        return $out;
    }

    private function toByte(int $cp): int
    {
        if ($cp < 0x100) {
            return $cp;   // ASCII, C1 controls and Latin-1 map to the same byte
        }

        return self::CP1252[$cp] ?? -1;
    }

    private function preview(string $s): string
    {
        $s = preg_replace('/\s+/', ' ', $s);

        return '"'.(mb_strlen($s) > 60 ? mb_substr($s, 0, 60).'…' : $s).'"';
    }
}
