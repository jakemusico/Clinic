<?php

require __DIR__ . '/../../vendor/autoload.php';
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$tables = ['notifications', 'chatbot_faqs', 'system_settings', 'clinic_services'];
$backupSql = "-- Database Backup Before Removing Medical Certificates & Health Forms" . PHP_EOL;
$backupSql .= "-- Export Date: " . date('Y-m-d H:i:s') . PHP_EOL . PHP_EOL;

foreach ($tables as $table) {
    $create = Illuminate\Support\Facades\DB::select("SHOW CREATE TABLE `" . $table . "`");
    $createProp = 'Create Table';
    $backupSql .= "DROP TABLE IF EXISTS `" . $table . "`;" . PHP_EOL;
    $backupSql .= $create[0]->$createProp . ";" . PHP_EOL . PHP_EOL;

    $rows = Illuminate\Support\Facades\DB::table($table)->get();
    if ($rows->count() > 0) {
        foreach ($rows as $row) {
            $rowArr = (array) $row;
            $cols = array_map(function($c) { return "`" . $c . "`"; }, array_keys($rowArr));
            $vals = array_map(function($v) {
                if (is_null($v)) return 'NULL';
                return Illuminate\Support\Facades\DB::getPdo()->quote($v);
            }, array_values($rowArr));
            $backupSql .= "INSERT INTO `" . $table . "` (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $vals) . ");" . PHP_EOL;
        }
        $backupSql .= PHP_EOL;
    }
}

$destPath = __DIR__ . '/backup_before_cleanup_' . date('Ymd_His') . '.sql';
file_put_contents($destPath, $backupSql);
echo "Backup successfully saved to: " . $destPath . " (" . strlen($backupSql) . " bytes)" . PHP_EOL;
