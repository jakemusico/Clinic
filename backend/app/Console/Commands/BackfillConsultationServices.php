<?php

namespace App\Console\Commands;

use App\Models\ClinicRecord;
use App\Models\DentalConsultation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/**
 * Fills in `service_name` on old consultations that were saved without one.
 *
 *   1. the service of the linked appointment, when there is one
 *   2. otherwise "Medical Consultation" (clinic_records) or "Dental Consultation" (dental_consultations)
 *
 * Safe to run more than once: it only touches rows whose service_name is still empty.
 *
 *   php artisan consultations:backfill-service --dry-run   print the affected rows, change nothing
 *   php artisan consultations:backfill-service             print them, back them up, ask, then update
 *   php artisan consultations:backfill-service --force     same, without the confirmation question
 *   php artisan consultations:backfill-service --restore=storage/app/backups/consultation-service-....json
 */
class BackfillConsultationServices extends Command
{
    protected $signature = 'consultations:backfill-service
                            {--dry-run : Only print the affected rows}
                            {--force : Do not ask for confirmation}
                            {--restore= : Put the service_name values saved in a backup file back}';

    protected $description = 'Backfill the service on old consultations that have no service saved (with a backup)';

    private const DEFAULTS = [
        'clinic_records'       => 'Medical Consultation',
        'dental_consultations' => 'Dental Consultation',
    ];

    private const DATE_COLUMN = [
        'clinic_records'       => 'visit_date',
        'dental_consultations' => 'consultation_date',
    ];

    public function handle(): int
    {
        if ($file = $this->option('restore')) {
            return $this->restore((string) $file);
        }

        $plan = [];
        foreach ([
            'clinic_records'       => ClinicRecord::class,
            'dental_consultations' => DentalConsultation::class,
        ] as $table => $model) {
            $rows = $model::query()
                ->with('appointment.service')
                ->where(fn ($q) => $q->whereNull('service_name')->orWhereRaw("TRIM(service_name) = ''"))
                ->orderBy('id')
                ->get();

            foreach ($rows as $row) {
                $fromAppointment = trim((string) $row->appointment?->service?->name);
                $plan[] = [
                    'table'  => $table,
                    'id'     => $row->id,
                    'date'   => $row->{self::DATE_COLUMN[$table]}?->format('Y-m-d') ?? '',
                    'appt'   => $row->appointment_id,
                    'new'    => $fromAppointment !== '' ? $fromAppointment : self::DEFAULTS[$table],
                    'source' => $fromAppointment !== '' ? 'appointment' : 'default',
                ];
            }
        }

        if (! $plan) {
            $this->info('No consultations without a service. Nothing to do.');

            return self::SUCCESS;
        }

        $this->info(count($plan).' consultation(s) have no service saved:');
        $this->table(
            ['Table', 'ID', 'Date', 'Appointment', 'Will be set to', 'Source'],
            array_map(fn ($p) => [$p['table'], $p['id'], $p['date'], $p['appt'] ?? '-', $p['new'], $p['source']], $plan)
        );

        if ($this->option('dry-run')) {
            $this->comment('Dry run: nothing was changed.');

            return self::SUCCESS;
        }

        // Back up the complete rows first, so the change can be undone with --restore.
        $backupDir = storage_path('app/backups');
        File::ensureDirectoryExists($backupDir);
        $backupFile = $backupDir.DIRECTORY_SEPARATOR.'consultation-service-'.now()->format('Ymd-His').'.json';
        $backup = [];
        foreach ($plan as $p) {
            $backup[] = [
                'table'        => $p['table'],
                'id'           => $p['id'],
                'service_name' => null,
                'row'          => (array) DB::table($p['table'])->where('id', $p['id'])->first(),
            ];
        }
        File::put($backupFile, json_encode($backup, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $this->info('Backup written to '.$backupFile);

        if (! $this->option('force') && ! $this->confirm('Update these rows?', false)) {
            $this->comment('Cancelled. Nothing was changed (the backup file was kept).');

            return self::SUCCESS;
        }

        $updated = 0;
        DB::transaction(function () use ($plan, &$updated) {
            foreach ($plan as $p) {
                // Re-check the column is still empty so a row edited in the meantime is never overwritten.
                $updated += DB::table($p['table'])
                    ->where('id', $p['id'])
                    ->where(fn ($q) => $q->whereNull('service_name')->orWhereRaw("TRIM(service_name) = ''"))
                    ->update(['service_name' => $p['new']]);
            }
        });

        $this->info("Updated {$updated} consultation(s).");

        return self::SUCCESS;
    }

    private function restore(string $file): int
    {
        $path = File::exists($file) ? $file : base_path($file);
        if (! File::exists($path)) {
            $this->error("Backup file not found: {$file}");

            return self::FAILURE;
        }

        $backup = json_decode(File::get($path), true);
        if (! is_array($backup)) {
            $this->error('The backup file is not valid.');

            return self::FAILURE;
        }

        $restored = 0;
        DB::transaction(function () use ($backup, &$restored) {
            foreach ($backup as $b) {
                if (! isset(self::DEFAULTS[$b['table']])) {
                    continue;
                }
                $restored += DB::table($b['table'])
                    ->where('id', $b['id'])
                    ->update(['service_name' => $b['row']['service_name'] ?? null]);
            }
        });

        $this->info("Restored {$restored} consultation(s) from {$path}.");

        return self::SUCCESS;
    }
}
