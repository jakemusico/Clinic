<?php

namespace App\Console\Commands;

use App\Models\ChatbotCategory;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One-time restore: load DATA (not schema) from a phpMyAdmin/mysqldump .sql file
 * into the current schema. Original IDs are preserved so foreign keys keep working.
 *
 * Column mapping handled here:
 *  - users.role        -> dropped; role_id is taken from the dump (role slug used as fallback)
 *  - notifications.linked_id -> folded into target_type/target_id, then dropped
 *  - chatbot_faqs.category    -> category_id resolved/created on chatbot_categories by name
 *  - calendar_events times    -> normalized to HH:MM:SS for the TIME columns
 *  - dental_consultations.status -> coerced into the completed/pending/cancelled enum
 *
 * Tables not present in the dump (complaint_categories, chatbot_categories, ...)
 * and framework tables (migrations, cache, sessions, jobs, ...) are never touched.
 */
class RestoreClinicBackup extends Command
{
    protected $signature = 'clinic:restore-backup {path : Path to the .sql dump file} {--force : Skip the confirmation prompt}';

    protected $description = 'Import data rows from a SQL dump into the current schema (keeps existing IDs)';

    /** Dump tables that must never be imported. */
    private const SKIP_TABLES = [
        'migrations', 'cache', 'cache_locks', 'sessions',
        'jobs', 'job_batches', 'failed_jobs', 'password_reset_tokens',
    ];

    /** Columns that no longer exist in the current schema. */
    private const DROP_COLUMNS = [
        'users'         => ['role'],
        'notifications' => ['linked_id'],
    ];

    /** FK-safe insert order (parents before children). */
    private const IMPORT_ORDER = [
        'roles', 'sections', 'users', 'patients', 'clinic_services',
        'complaint_categories', 'clinic_staff_schedules', 'clinic_staff_unavailability',
        'appointments', 'clinic_records', 'dental_charts', 'dental_chart_teeth',
        'dental_consultations',
        'inventory_items', 'inventory_batches', 'inventory_transactions',
        'chatbot_categories', 'chatbot_faqs',
        'conversations', 'messages', 'notifications', 'announcements', 'calendar_events',
        'system_settings', 'audit_logs', 'chatbot_question_logs',
        'personal_access_tokens',
    ];

    /** Columns where an empty string must become NULL (temporal types). */
    private const TEMPORAL_COLUMNS = [
        'date_of_birth', 'visit_date', 'consultation_date', 'scheduled_at',
        'transaction_date', 'expiry_date', 'received_date', 'unavailable_date',
        'last_message_at', 'start_date', 'end_date', 'start_time', 'end_time',
        'created_at', 'updated_at', 'edited_at', 'read_at', 'deleted_at',
        'email_verified_at', 'last_active_at', 'terms_accepted_at',
        'reminder_24h_sent_at', 'reminder_1h_sent_at',
    ];

    private const DENTAL_STATUSES = ['completed', 'pending', 'cancelled'];

    public function handle(): int
    {
        $path = $this->argument('path');
        if (! is_file($path)) {
            $this->error("File not found: {$path}");
            return self::FAILURE;
        }

        $tables = $this->parseDump($path);
        if (! $tables) {
            $this->error('No INSERT statements found in the dump.');
            return self::FAILURE;
        }

        // Only tables we know, in FK-safe order; anything else in the dump is ignored.
        $ordered = [];
        foreach (self::IMPORT_ORDER as $t) {
            if (isset($tables[$t]['rows']) && $tables[$t]['rows'] !== []) {
                $ordered[$t] = $tables[$t];
            }
        }
        $ignored = array_diff(array_keys($tables), array_keys($ordered), self::SKIP_TABLES);
        if ($ignored) {
            $this->warn('Ignoring dump tables not in the import list: ' . implode(', ', $ignored));
        }

        $totalRows = array_sum(array_map(fn ($t) => count($t['rows']), $ordered));
        $this->info("Parsed " . count($ordered) . " tables / {$totalRows} rows from " . basename($path));

        if (! $this->option('force') && ! $this->confirm('This will DELETE all existing rows in the tables being restored, then import the backup. Continue?', false)) {
            $this->warn('Aborted.');
            return self::SUCCESS;
        }

        // Wipe the tables we are about to fill (they only hold fresh seed data),
        // children first is unnecessary with FK checks disabled.
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        foreach (array_keys($ordered) as $table) {
            DB::table($table)->delete();
        }

        $roleIdBySlug = DB::table('roles')->pluck('id', 'slug')->all();
        // Roles may have just been wiped — rebuild the map after the roles import instead.
        $stats = [];

        foreach ($ordered as $table => $data) {
            if ($table === 'roles') {
                // Roles must exist before users resolve role_id fallbacks.
                $stats[$table] = $this->importTable($table, $data, $roleIdBySlug);
                $roleIdBySlug = DB::table('roles')->pluck('id', 'slug')->all();
                continue;
            }
            $stats[$table] = $this->importTable($table, $data, $roleIdBySlug);
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        $this->newLine();
        $this->info('Restore complete. Row counts (dump -> now):');
        $this->table(
            ['Table', 'Dump rows', 'Inserted', 'Skipped', 'Current rows'],
            collect($stats)->map(fn ($s, $t) => [
                $t, $s['dump'], $s['inserted'], $s['skipped'], $s['current'],
            ])->values()->all()
        );

        $failed = collect($stats)->contains(fn ($s) => $s['errors'] > 0);
        if ($failed) {
            $this->warn('Some rows failed to insert (see errors above).');
        }
        $this->line('Next step for medical text columns: php artisan data:encrypt-existing');

        return self::SUCCESS;
    }

    /**
     * @return array{dump:int,inserted:int,skipped:int,errors:int,current:int}
     */
    private function importTable(string $table, array $data, array $roleIdBySlug): array
    {
        $dumpCols   = $data['columns'];
        $rows       = $data['rows'];
        $currentCols = Schema::getColumnListing($table);
        $drop       = self::DROP_COLUMNS[$table] ?? [];

        // Columns we can actually write: dump columns that still exist, minus dropped ones.
        $writeCols = [];
        foreach ($dumpCols as $i => $col) {
            if (in_array($col, $drop, true) || ! in_array($col, $currentCols, true)) {
                continue;
            }
            $writeCols[$col] = $i;
        }

        $inserted = $skipped = $errors = 0;
        $existingIds = $this->existingIds($table);
        $existingEmails = $table === 'users'
            ? DB::table('users')->pluck('id', 'email')->all()
            : [];

        foreach ($rows as $row) {
            $assoc = [];
            foreach ($writeCols as $col => $i) {
                $assoc[$col] = $row[$i] ?? null;
            }

            $assoc = $this->transformRow($table, $assoc, $row, $dumpCols, $roleIdBySlug);
            if ($assoc === null) {
                $skipped++;
                continue;
            }

            // Keep original IDs; skip anything that already exists.
            $id = $assoc['id'] ?? null;
            if ($id !== null && isset($existingIds[$id])) {
                $skipped++;
                continue;
            }
            if ($table === 'users' && isset($existingEmails[$assoc['email'] ?? ''])) {
                $skipped++;
                continue;
            }

            try {
                DB::table($table)->insert($assoc);
                if ($id !== null) {
                    $existingIds[$id] = true;
                }
                if ($table === 'users') {
                    $existingEmails[$assoc['email']] = $id;
                }
                $inserted++;
            } catch (\Throwable $e) {
                $errors++;
                $this->warn("  [{$table}] row id=" . ($id ?? '?') . " failed: " . $e->getMessage());
            }
        }

        return [
            'dump'     => count($rows),
            'inserted' => $inserted,
            'skipped'  => $skipped,
            'errors'   => $errors,
            'current'  => DB::table($table)->count(),
        ];
    }

    /** @return array<int,true> */
    private function existingIds(string $table): array
    {
        if (! Schema::hasColumn($table, 'id')) {
            return [];
        }
        return DB::table($table)->pluck('id')->mapWithKeys(fn ($id) => [$id => true])->all();
    }

    /**
     * Table-specific column mapping. $assoc holds only writable columns;
     * $rawRow/$dumpCols give access to dropped columns (e.g. the old role slug).
     */
    private function transformRow(string $table, array $assoc, array $rawRow, array $dumpCols, array $roleIdBySlug): ?array
    {
        // '' -> NULL for temporal columns
        foreach (self::TEMPORAL_COLUMNS as $col) {
            if (array_key_exists($col, $assoc) && $assoc[$col] === '') {
                $assoc[$col] = null;
            }
        }

        switch ($table) {
            case 'users':
                // role_id fallback from the dropped `role` slug when the dump left it empty
                if (empty($assoc['role_id'])) {
                    $roleSlug = $this->rawValue($rawRow, $dumpCols, 'role');
                    $assoc['role_id'] = $roleIdBySlug[$roleSlug] ?? $roleIdBySlug['student'] ?? null;
                }
                break;

            case 'notifications':
                // linked_id -> target_type/target_id (same inference the old migration used)
                $linkedId = $this->rawValue($rawRow, $dumpCols, 'linked_id');
                if ($linkedId !== null && (empty($assoc['target_id']))) {
                    $assoc['target_id'] = $linkedId;
                    if (empty($assoc['target_type'])) {
                        $assoc['target_type'] = ($assoc['type'] ?? null) === 'announcement'
                            ? 'announcement'
                            : (($assoc['action_url'] ?? null) === '/calendar' ? 'calendar_event' : null);
                    }
                }
                break;

            case 'chatbot_faqs':
                $name = strtolower(trim((string) ($assoc['category'] ?? '')));
                if ($name !== '') {
                    $assoc['category_id'] = $this->categoryId($name);
                }
                break;

            case 'calendar_events':
                foreach (['start_time', 'end_time'] as $col) {
                    if (isset($assoc[$col]) && $assoc[$col] !== null && $assoc[$col] !== '') {
                        try {
                            $assoc[$col] = Carbon::parse($assoc[$col])->format('H:i:s');
                        } catch (\Throwable) {
                            $assoc[$col] = null;
                        }
                    }
                }
                break;

            case 'dental_consultations':
                if (isset($assoc['status']) && ! in_array($assoc['status'], self::DENTAL_STATUSES, true)) {
                    $assoc['status'] = 'completed';
                }
                break;

            case 'clinic_staff_schedules':
                // The unique(user_id,day,start,end) constraint rejects exact dupes; keep first.
                static $seenSlots = [];
                $key = ($assoc['user_id'] ?? '') . '|' . ($assoc['day_of_week'] ?? '') . '|'
                    . ($assoc['start_time'] ?? '') . '|' . ($assoc['end_time'] ?? '');
                if (isset($seenSlots[$key])) {
                    return null;
                }
                $seenSlots[$key] = true;
                break;
        }

        return $assoc;
    }

    private function rawValue(array $row, array $cols, string $name)
    {
        $i = array_search($name, $cols, true);
        return $i === false ? null : ($row[$i] ?? null);
    }

    private function categoryId(string $name): int
    {
        static $cache = [];
        if (! isset($cache[$name])) {
            $cache[$name] = ChatbotCategory::firstOrCreate(
                ['name' => $name],
                ['is_active' => true]
            )->id;
        }
        return $cache[$name];
    }

    /**
     * Extract every `INSERT INTO `table` (cols) VALUES ...;` block and parse
     * the row tuples into PHP values.
     *
     * @return array<string,array{columns:string[],rows:array<int,array<int,mixed>>}>
     */
    private function parseDump(string $path): array
    {
        $sql = file_get_contents($path);
        if ($sql === false) {
            return [];
        }

        preg_match_all(
            '/INSERT INTO `?(\w+)`?\s*\(([^)]*)\)\s*VALUES\s*/i',
            $sql,
            $matches,
            PREG_OFFSET_CAPTURE
        );

        $tables = [];
        foreach ($matches[0] as $i => $full) {
            $table = $matches[1][$i][0];
            if (in_array($table, self::SKIP_TABLES, true)) {
                continue;
            }
            $cols = array_map(
                fn ($c) => trim($c, " `\t\n\r\"'"),
                explode(',', $matches[2][$i][0])
            );

            $start = $matches[0][$i][1] + strlen($matches[0][$i][0]);
            $end   = $this->valuesEnd($sql, $start);
            if ($end === null) {
                continue;
            }

            $tables[$table] = [
                'columns' => $cols,
                'rows'    => $this->parseValues(substr($sql, $start, $end - $start)),
            ];
        }

        return $tables;
    }

    /** Offset of the ';' that terminates the VALUES list (outside strings/parens). */
    private function valuesEnd(string $sql, int $pos): ?int
    {
        $len = strlen($sql);
        $inStr = false;
        for ($i = $pos; $i < $len; $i++) {
            $ch = $sql[$i];
            if ($inStr) {
                if ($ch === '\\') {
                    $i++; // skip escaped char
                } elseif ($ch === "'") {
                    $inStr = false;
                }
                continue;
            }
            if ($ch === "'") {
                $inStr = true;
            } elseif ($ch === ';') {
                return $i;
            }
        }
        return null;
    }

    /**
     * Parse `(v,v,...),(v,v,...)` into rows of PHP values.
     *
     * @return array<int,array<int,mixed>>
     */
    private function parseValues(string $blob): array
    {
        $rows = [];
        $len  = strlen($blob);
        $i    = 0;

        while ($i < $len) {
            // find next tuple start
            while ($i < $len && ! in_array($blob[$i], ['(', "'", 'N', 'n', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '+', '.', '_'], true)) {
                $i++;
            }
            if ($i >= $len) {
                break;
            }
            if ($blob[$i] !== '(') {
                // stray token between tuples (e.g. "),") — skip safely
                $i++;
                continue;
            }

            $i++; // consume '('
            $row = [];
            while (true) {
                $this->skipWs($blob, $i);
                if ($i >= $len) {
                    break 2;
                }
                if ($blob[$i] === ')') {
                    $i++;
                    break;
                }

                [$value, $i] = $this->parseLiteral($blob, $i);
                $row[] = $value;

                $this->skipWs($blob, $i);
                if ($i < $len && $blob[$i] === ',') {
                    $i++;
                    continue;
                }
                if ($i < $len && $blob[$i] === ')') {
                    $i++;
                    break;
                }
                // malformed — bail out of this tuple
                break;
            }
            $rows[] = $row;
        }

        return $rows;
    }

    private function skipWs(string $s, int &$i): void
    {
        while ($i < strlen($s) && in_array($s[$i], [" ", "\t", "\n", "\r"], true)) {
            $i++;
        }
    }

    /** @return array{0:mixed,1:int} [value, new offset] */
    private function parseLiteral(string $s, int $i): array
    {
        $len = strlen($s);
        $ch  = $s[$i];

        // charset introducers like _utf8'...' or _binary'...'
        if ($ch === '_' && preg_match('/^_(?:utf8mb4|utf8|binary|latin1)/i', substr($s, $i))) {
            $q = strpos($s, "'", $i);
            if ($q !== false) {
                return $this->parseQuoted($s, $q);
            }
        }

        if ($ch === "'") {
            return $this->parseQuoted($s, $i);
        }
        if ($ch === '"') {
            // double-quoted string (ANSI mode dumps)
            return $this->parseQuoted($s, $i, '"');
        }

        // bare literal: NULL, TRUE, FALSE, number, hex
        $start = $i;
        while ($i < $len && ! in_array($s[$i], [',', ')', ' ', "\t", "\n", "\r"], true)) {
            $i++;
        }
        $lit = substr($s, $start, $i - $start);

        if (preg_match('/^null$/i', $lit)) {
            return [null, $i];
        }
        if (preg_match('/^(true|false)$/i', $lit)) {
            return [strtolower($lit) === 'true' ? 1 : 0, $i];
        }
        if (is_numeric($lit)) {
            return [str_contains($lit, '.') ? (float) $lit : (int) $lit, $i];
        }
        return [$lit, $i]; // hex/binary literal — pass through as string
    }

    /** Parse a quoted string starting at $i (which points at the quote char). */
    private function parseQuoted(string $s, int $i, string $quote = "'"): array
    {
        $len = strlen($s);
        $i++; // opening quote
        $out = '';

        while ($i < $len) {
            $ch = $s[$i];
            if ($ch === '\\' && $i + 1 < $len) {
                $next = $s[$i + 1];
                $out .= match ($next) {
                    '0'  => "\0",
                    'b'  => "\x08",
                    'n'  => "\n",
                    'r'  => "\r",
                    't'  => "\t",
                    'Z'  => "\x1a",
                    default => $next, // \' \\ \" etc.
                };
                $i += 2;
                continue;
            }
            if ($ch === $quote) {
                // '' escape inside string
                if ($quote === "'" && $i + 1 < $len && $s[$i + 1] === "'") {
                    $out .= "'";
                    $i += 2;
                    continue;
                }
                return [$out, $i + 1];
            }
            $out .= $ch;
            $i++;
        }

        return [$out, $i];
    }
}
