<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\ClinicRecord;
use App\Models\ClinicService;
use App\Models\DentalConsultation;
use App\Models\InventoryBatch;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Models\Conversation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Support\ConsultationRow;
use App\Support\Placeholder;

class ReportController extends Controller
{
    /**
     * Categorize a complaint/diagnosis into standard categories (matches DashboardController).
     */
    public function categorizeComplaint(?string $category, ?string $complaint, ?string $diagnosis, string $type = 'medical'): string
    {
        if (!empty($category) && trim($category) !== '') {
            return trim($category);
        }

        $text = strtolower(trim(($complaint ?? '') . ' ' . ($diagnosis ?? '')));

        if (empty($text)) {
            return $type === 'dental' ? 'Dental Checkup' : 'Other';
        }

        if (str_contains($text, 'fever') || str_contains($text, 'flu') || str_contains($text, 'trangkaso') || str_contains($text, 'temperature') || str_contains($text, 'lagnat')) {
            return 'Fever/Flu';
        }
        if (str_contains($text, 'headache') || str_contains($text, 'migraine') || str_contains($text, 'head ache') || str_contains($text, 'sakit ng ulo')) {
            return 'Headache';
        }
        if (str_contains($text, 'cough') || str_contains($text, 'cold') || str_contains($text, 'ubo') || str_contains($text, 'sipon') || str_contains($text, 'sore throat') || str_contains($text, 'pharyngitis')) {
            return 'Cough/Colds';
        }
        if (str_contains($text, 'stomach') || str_contains($text, 'abdomen') || str_contains($text, 'abdominal') || str_contains($text, 'diarrhea') || str_contains($text, 'gastritis') || str_contains($text, 'sakit ng tyan') || str_contains($text, 'nausea') || str_contains($text, 'vomit')) {
            return 'Stomach Pain';
        }
        if (str_contains($text, 'wound') || str_contains($text, 'injury') || str_contains($text, 'cut') || str_contains($text, 'laceration') || str_contains($text, 'sprain') || str_contains($text, 'burn') || str_contains($text, 'trauma') || str_contains($text, 'first aid')) {
            return 'Injury/Wound';
        }
        if (str_contains($text, 'allergy') || str_contains($text, 'allergic') || str_contains($text, 'rhinitis') || str_contains($text, 'rash') || str_contains($text, 'itch')) {
            return 'Allergy';
        }
        if (str_contains($text, 'dizziness') || str_contains($text, 'dizzy') || str_contains($text, 'bp') || str_contains($text, 'blood pressure') || str_contains($text, 'hypertension') || str_contains($text, 'vertigo') || str_contains($text, 'hilo')) {
            return 'Dizziness/BP';
        }
        if (str_contains($text, 'toothache') || str_contains($text, 'tooth ache') || str_contains($text, 'dental pain') || str_contains($text, 'ngipin') || str_contains($text, 'pulpitis')) {
            return 'Toothache';
        }
        if (str_contains($text, 'clean') || str_contains($text, 'prophylaxis') || str_contains($text, 'scaling') || str_contains($text, 'tartar')) {
            return 'Dental Cleaning';
        }
        if (str_contains($text, 'extract') || str_contains($text, 'bunot')) {
            return 'Extraction';
        }
        if (str_contains($text, 'fill') || str_contains($text, 'caries') || str_contains($text, 'cavity') || str_contains($text, 'pasta') || str_contains($text, 'restoration')) {
            return 'Tooth Filling';
        }
        if (str_contains($text, 'gingivitis') || str_contains($text, 'gum') || str_contains($text, 'periodont')) {
            return 'Gum Problem';
        }

        return 'Other';
    }

    /**
     * Calculate current stock for an item from transactions.
     */
    private function getStock(int $itemId): int
    {
        $in  = (int) InventoryTransaction::where('item_id', $itemId)->where('type', 'IN')->sum('quantity');
        $out = (int) InventoryTransaction::where('item_id', $itemId)->where('type', 'OUT')->sum('quantity');
        return max(0, $in - $out);
    }

    /**
     * GET /api/reports/appointments
     */
    public function appointmentSummary(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!in_array($user->role, ['clinic_staff', 'dentist', 'admin'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $roleType = match ($user->role) {
            'dentist'      => 'dental',
            'clinic_staff' => 'medical',
            default        => in_array($request->query('type'), ['medical', 'dental']) ? $request->query('type') : null,
        };

        $query = Appointment::with([
            'patient.user',
            'service',
            'staff',
            'clinicRecord',
            'dentalConsultation',
        ]);

        if ($roleType) {
            $query->where('appointment_type', $roleType);
        }

        $dateFrom = $request->query('date_from', Carbon::now()->startOfMonth()->toDateString());
        $dateTo   = $request->query('date_to', Carbon::now()->endOfMonth()->toDateString());

        $query->whereDate('scheduled_at', '>=', $dateFrom)
              ->whereDate('scheduled_at', '<=', $dateTo);

        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->has('service_id') && $request->service_id !== 'all') {
            $query->where('service_id', $request->service_id);
        }

        if ($request->has('staff_id') && $request->staff_id !== 'all') {
            $query->where('staff_id', $request->staff_id);
        }

        $statsQuery = clone $query;
        $appointments = $query->orderBy('scheduled_at', 'desc')->get();

        $total     = $statsQuery->count();
        $completed = (clone $statsQuery)->where('status', 'completed')->count();
        $cancelled = (clone $statsQuery)->where('status', 'cancelled')->count();
        $confirmed = (clone $statsQuery)->where('status', 'confirmed')->count();
        $pending   = (clone $statsQuery)->where('status', 'pending')->count();

        $completedPct = $total > 0 ? round(($completed / $total) * 100, 1) : 0;
        $cancelledPct = $total > 0 ? round(($cancelled / $total) * 100, 1) : 0;

        // Service popularity
        $servicesQuery = ClinicService::select('id', 'name');
        if ($roleType === 'dental') {
            $servicesQuery->where(function ($q) {
                $q->where('name', 'like', '%dental%')
                  ->orWhere('name', 'like', '%tooth%')
                  ->orWhere('name', 'like', '%teeth%')
                  ->orWhere('name', 'like', '%oral%')
                  ->orWhere('name', 'like', '%extraction%')
                  ->orWhere('name', 'like', '%filling%')
                  ->orWhere('name', 'like', '%cleaning%');
            });
        } elseif ($roleType === 'medical') {
            $servicesQuery->where(function ($q) {
                $q->whereNotIn('name', function ($sub) {
                    $sub->select('name')->from('clinic_services')
                        ->where('name', 'like', '%dental%')
                        ->orWhere('name', 'like', '%tooth%')
                        ->orWhere('name', 'like', '%extraction%');
                });
            });
        }

        $byService = $servicesQuery
            ->withCount(['appointments' => function ($q) use ($dateFrom, $dateTo, $roleType) {
                $q->whereDate('scheduled_at', '>=', $dateFrom)
                  ->whereDate('scheduled_at', '<=', $dateTo);
                if ($roleType) $q->where('appointment_type', $roleType);
            }])
            ->get()
            ->map(fn($s) => ['name' => $s->name, 'count' => $s->appointments_count])
            ->sortByDesc('count')
            ->values();

        // Group by date
        $byDateQuery = Appointment::select(DB::raw('DATE(scheduled_at) as date'), DB::raw('count(*) as count'))
            ->whereDate('scheduled_at', '>=', $dateFrom)
            ->whereDate('scheduled_at', '<=', $dateTo);

        if ($roleType) {
            $byDateQuery->where('appointment_type', $roleType);
        }

        $byDate = $byDateQuery->groupBy(DB::raw('DATE(scheduled_at)'))
            ->orderBy('date')
            ->get();

        $staffQuery = User::orderBy('name');
        if ($roleType === 'dental') {
            $staffQuery->where('role', 'dentist');
        } elseif ($roleType === 'medical') {
            $staffQuery->where('role', 'clinic_staff');
        } else {
            $staffQuery->whereIn('role', ['clinic_staff', 'dentist']);
        }
        $staff = $staffQuery->get(['id', 'name']);
        $filterServices = ClinicService::orderBy('name')->get(['id', 'name']);

        return response()->json([
            'appointments' => $appointments,
            'summary'      => [
                'total'         => $total,
                'completed'     => $completed,
                'completed_pct' => $completedPct,
                'cancelled'     => $cancelled,
                'cancelled_pct' => $cancelledPct,
                'confirmed'     => $confirmed,
                'pending'       => $pending,
            ],
            'by_service' => $byService,
            'by_date'    => $byDate,
            'filters'    => [
                'services'  => $filterServices,
                'staff'     => $staff,
                'date_from' => $dateFrom,
                'date_to'   => $dateTo,
            ],
        ]);
    }

    /**
     * GET /api/reports/consultations
     */
    public function consultationSummary(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!in_array($user->role, ['clinic_staff', 'dentist', 'admin'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $roleType = match ($user->role) {
            'dentist'      => 'dental',
            'clinic_staff' => 'medical',
            default        => in_array($request->query('type'), ['medical', 'dental']) ? $request->query('type') : null,
        };

        $dateFrom = $request->query('date_from', Carbon::now()->startOfMonth()->toDateString());
        $dateTo   = $request->query('date_to', Carbon::now()->endOfMonth()->toDateString());
        $serviceId = $request->query('service_id');
        $staffId   = $request->query('staff_id');

        $consultations = collect();

        // 1. Medical Consultations (ClinicRecord)
        if (!$roleType || $roleType === 'medical') {
            $medQuery = ClinicRecord::with(['patient.user', 'appointment.service', 'createdBy'])
                ->where(function ($q) use ($dateFrom, $dateTo) {
                    $q->whereBetween('visit_date', [$dateFrom, $dateTo])
                      ->orWhere(function ($sub) use ($dateFrom, $dateTo) {
                          $sub->whereNull('visit_date')->whereBetween('created_at', ["{$dateFrom} 00:00:00", "{$dateTo} 23:59:59"]);
                      });
                });

            if ($serviceId && $serviceId !== 'all') {
                // match the service saved on the record, or the one of the linked appointment
                $svcName = (string) ClinicService::whereKey($serviceId)->value('name');
                $medQuery->where(fn($sq) => $sq
                    ->whereHas('appointment', fn($a) => $a->where('service_id', $serviceId))
                    ->orWhere('service_name', $svcName));
            }
            if ($staffId && $staffId !== 'all') {
                $medQuery->where('created_by', $staffId);
            }

            $medRecords = $medQuery->get()->map(fn ($r) => ConsultationRow::medical($r));

            $consultations = $consultations->merge($medRecords);
        }

        // 2. Dental Consultations (DentalConsultation)
        if (!$roleType || $roleType === 'dental') {
            $dentQuery = DentalConsultation::with(['patient.user', 'appointment.service', 'dentist'])
                ->where(function ($q) use ($dateFrom, $dateTo) {
                    $q->whereBetween('consultation_date', [$dateFrom, $dateTo])
                      ->orWhere(function ($sub) use ($dateFrom, $dateTo) {
                          $sub->whereNull('consultation_date')->whereBetween('created_at', ["{$dateFrom} 00:00:00", "{$dateTo} 23:59:59"]);
                      });
                });

            if ($serviceId && $serviceId !== 'all') {
                // match the service saved on the record, or the one of the linked appointment
                $svcName = (string) ClinicService::whereKey($serviceId)->value('name');
                $dentQuery->where(fn($sq) => $sq
                    ->whereHas('appointment', fn($a) => $a->where('service_id', $serviceId))
                    ->orWhere('service_name', $svcName));
            }
            if ($staffId && $staffId !== 'all') {
                $dentQuery->where('created_by', $staffId);
            }

            $dentRecords = $dentQuery->get()->map(fn ($c) => ConsultationRow::dental($c));

            $consultations = $consultations->merge($dentRecords);
        }

        // Sort descending by date
        $sorted = $consultations->sortByDesc(fn($v) => ($v['raw_date'] ?? '') . ' ' . ($v['created_at'] ?? ''))->values();

        // Trend over time (by date)
        $dateCounts = [];
        foreach ($sorted as $c) {
            $d = $c['raw_date'] ?: Carbon::parse($c['created_at'])->toDateString();
            if ($d) {
                $dateCounts[$d] = ($dateCounts[$d] ?? 0) + 1;
            }
        }
        ksort($dateCounts);
        $byDate = [];
        foreach ($dateCounts as $date => $count) {
            $byDate[] = [
                'date'  => $date,
                'count' => $count,
            ];
        }

        // Service/Type breakdown
        $serviceCounts = [];
        foreach ($sorted as $c) {
            $srv = $c['service'] ?: 'Not specified';
            $serviceCounts[$srv] = ($serviceCounts[$srv] ?? 0) + 1;
        }
        arsort($serviceCounts);
        $byService = [];
        foreach ($serviceCounts as $name => $count) {
            $byService[] = ['name' => $name, 'count' => $count];
        }

        $totalConsultations = $sorted->count();
        $medCount = $sorted->where('type', 'medical')->count();
        $dentCount = $sorted->where('type', 'dental')->count();
        $studentCount = $sorted->where('role', 'student')->count();
        $staffCount = $sorted->where('role', 'faculty_staff')->count();

        $staffQuery = User::orderBy('name');
        if ($roleType === 'dental') {
            $staffQuery->where('role', 'dentist');
        } elseif ($roleType === 'medical') {
            $staffQuery->where('role', 'clinic_staff');
        } else {
            $staffQuery->whereIn('role', ['clinic_staff', 'dentist']);
        }
        $staff = $staffQuery->get(['id', 'name']);
        $filterServices = ClinicService::orderBy('name')->get(['id', 'name']);

        return response()->json([
            'consultations' => $sorted,
            'summary'       => [
                'total'         => $totalConsultations,
                'medical_count' => $medCount,
                'dental_count'  => $dentCount,
                'student_count' => $studentCount,
                'staff_count'   => $staffCount,
            ],
            'by_date'       => $byDate,
            'by_service'    => $byService,
            'filters'       => [
                'services'  => $filterServices,
                'staff'     => $staff,
                'date_from' => $dateFrom,
                'date_to'   => $dateTo,
            ],
        ]);
    }

    /**
     * GET /api/reports/inventory
     */
    public function inventorySummary(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!in_array($user->role, ['clinic_staff', 'dentist', 'admin'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $dateFrom = $request->query('date_from', Carbon::now()->startOfMonth()->toDateString());
        $dateTo   = $request->query('date_to', Carbon::now()->endOfMonth()->toDateString());
        $today    = Carbon::today()->toDateString();
        $in30Days = Carbon::today()->addDays(30)->toDateString();

        $items = InventoryItem::orderBy('name')->get();
        $itemList = [];
        $lowStockItems = [];
        $categoryCounts = [];
        $categoryStock = [];

        $totalStock = 0;
        $lowStockCount = 0;
        $outOfStockCount = 0;

        foreach ($items as $item) {
            $isEquipment = $item->category === 'Equipment';
            $stock = $isEquipment ? null : $this->getStock($item->id);

            $status = 'normal';
            if (!$isEquipment) {
                $totalStock += $stock;
                if ($stock <= 0) {
                    $status = 'out_of_stock';
                    $outOfStockCount++;
                    $lowStockCount++;
                } elseif ($stock <= $item->reorder_level) {
                    $status = 'low_stock';
                    $lowStockCount++;
                }
            }

            $cat = $item->category ?: 'General';
            $categoryCounts[$cat] = ($categoryCounts[$cat] ?? 0) + 1;
            if (!$isEquipment) {
                $categoryStock[$cat] = ($categoryStock[$cat] ?? 0) + $stock;
            }

            $record = [
                'id'            => $item->id,
                'name'          => $item->name,
                'category'      => $item->category,
                'unit'          => $item->unit,
                'reorder_level' => $item->reorder_level,
                'current_stock' => $stock,
                'status'        => $status,
                'location'      => $item->location ?: 'Clinic Storage',
            ];

            $itemList[] = $record;

            if (!$isEquipment && $stock <= $item->reorder_level) {
                $lowStockItems[] = $record;
            }
        }

        // Expiring / expired batches
        $expiringBatches = InventoryBatch::with('item')
            ->whereNotNull('expiry_date')
            ->where('quantity_in', '>', DB::raw('quantity_used'))
            ->orderBy('expiry_date')
            ->get()
            ->filter(fn($b) => $b->expiry_date->toDateString() <= $in30Days)
            ->values()
            ->map(fn($b) => [
                'id'          => $b->id,
                'item_id'     => $b->item_id,
                'item_name'   => $b->item->name ?? 'Unknown',
                'category'    => $b->item->category ?? 'General',
                'batch_no'    => $b->batch_no,
                'supplier'    => $b->supplier ?: Placeholder::EMPTY,
                'expiry_date' => $b->expiry_date->toDateString(),
                'remaining'   => max(0, $b->quantity_in - $b->quantity_used),
                'is_expired'  => $b->expiry_date->toDateString() <= $today,
                'status'      => $b->expiry_date->toDateString() <= $today ? 'Expired' : 'Expiring Soon',
            ]);

        $expiredCount = $expiringBatches->where('is_expired', true)->count();
        $expiringSoonCount = $expiringBatches->where('is_expired', false)->count();

        // Usage / Transactions in the date range
        $txQuery = InventoryTransaction::with(['item', 'batch', 'recordedBy', 'patientUser'])
            ->whereBetween('transaction_date', [$dateFrom, $dateTo]);

        $transactions = $txQuery->orderByDesc('created_at')->get()->map(function ($t) {
            $u = $t->patientUser;
            $staff = $t->recordedBy;
            return [
                'id'               => $t->id,
                'item_name'        => $t->item->name ?? 'Unknown Item',
                'category'         => $t->item->category ?? 'General',
                'batch_no'         => $t->batch->batch_no ?? Placeholder::EMPTY,
                'type'             => $t->type,
                'quantity'         => $t->quantity,
                'reason'           => $t->reason ?: 'Usage / Dispensed',
                'recorded_by'      => $staff?->name ?? 'Staff',
                'patient_name'     => $u?->name ?? Placeholder::EMPTY,
                'student_id'       => $u?->student_id ?? ($u?->employee_id ?? Placeholder::EMPTY),
                'transaction_date' => $t->transaction_date ? Carbon::parse($t->transaction_date)->format('M j, Y') : ($t->created_at ? $t->created_at->format('M j, Y') : Placeholder::EMPTY),
                'raw_date'         => $t->transaction_date ? Carbon::parse($t->transaction_date)->toDateString() : ($t->created_at ? $t->created_at->toDateString() : ''),
            ];
        });

        $totalDispensed = $transactions->where('type', 'OUT')->sum('quantity');
        $totalReceived  = $transactions->where('type', 'IN')->sum('quantity');

        // Usage over time (grouped by date)
        $usageDates = [];
        foreach ($transactions as $t) {
            $d = $t['raw_date'];
            if ($d) {
                if (!isset($usageDates[$d])) {
                    $usageDates[$d] = ['date' => $d, 'dispensed' => 0, 'received' => 0];
                }
                if ($t['type'] === 'OUT') {
                    $usageDates[$d]['dispensed'] += $t['quantity'];
                } else {
                    $usageDates[$d]['received'] += $t['quantity'];
                }
            }
        }
        ksort($usageDates);
        $usageByDate = array_values($usageDates);

        // Chart data by category
        $byCategory = [];
        foreach ($categoryCounts as $name => $count) {
            $byCategory[] = [
                'name'  => $name,
                'items' => $count,
                'stock' => $categoryStock[$name] ?? 0,
            ];
        }

        return response()->json([
            'summary' => [
                'total_items'         => $items->count(),
                'total_stock'         => $totalStock,
                'low_stock_count'     => $lowStockCount,
                'out_of_stock_count'  => $outOfStockCount,
                'expiring_soon_count' => $expiringSoonCount,
                'expired_count'       => $expiredCount,
                'total_dispensed'     => $totalDispensed,
                'total_received'      => $totalReceived,
            ],
            'items'             => $itemList,
            'low_stock_items'   => $lowStockItems,
            'expiring_batches'  => $expiringBatches,
            'transactions'      => $transactions,
            'usage_by_date'     => $usageByDate,
            'by_category'       => $byCategory,
            'filters'           => [
                'date_from' => $dateFrom,
                'date_to'   => $dateTo,
            ],
        ]);
    }

    /**
     * GET /api/reports/frequent-symptoms
     */
    public function symptomsSummary(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!in_array($user->role, ['clinic_staff', 'dentist', 'admin'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $roleType = match ($user->role) {
            'dentist'      => 'dental',
            'clinic_staff' => 'medical',
            default        => in_array($request->query('type'), ['medical', 'dental']) ? $request->query('type') : null,
        };

        $dateFrom = $request->query('date_from', Carbon::now()->startOfMonth()->toDateString());
        $dateTo   = $request->query('date_to', Carbon::now()->endOfMonth()->toDateString());
        $serviceId = $request->query('service_id');
        $staffId   = $request->query('staff_id');

        $categoryCounts = [];
        $totalSymptomsCount = 0;
        $consultationLogs = [];

        // 1. Medical symptoms
        if (!$roleType || $roleType === 'medical') {
            $medQuery = ClinicRecord::with(['patient.user', 'appointment.service', 'createdBy'])
                ->where(function ($q) use ($dateFrom, $dateTo) {
                    $q->whereBetween('visit_date', [$dateFrom, $dateTo])
                      ->orWhere(function ($sub) use ($dateFrom, $dateTo) {
                          $sub->whereNull('visit_date')->whereBetween('created_at', ["{$dateFrom} 00:00:00", "{$dateTo} 23:59:59"]);
                      });
                });

            if ($serviceId && $serviceId !== 'all') {
                // match the service saved on the record, or the one of the linked appointment
                $svcName = (string) ClinicService::whereKey($serviceId)->value('name');
                $medQuery->where(fn($sq) => $sq
                    ->whereHas('appointment', fn($a) => $a->where('service_id', $serviceId))
                    ->orWhere('service_name', $svcName));
            }
            if ($staffId && $staffId !== 'all') {
                $medQuery->where('created_by', $staffId);
            }

            $medRecords = $medQuery->get();
            foreach ($medRecords as $r) {
                $cat = $this->categorizeComplaint($r->complaint_category, $r->chief_complaint, $r->diagnosis, 'medical');
                $categoryCounts[$cat] = ($categoryCounts[$cat] ?? 0) + 1;
                $totalSymptomsCount++;

                $u = $r->patient?->user;
                $vDate = ConsultationRow::day($r);
                $consultationLogs[] = [
                    'id'               => "med-{$r->id}",
                    'type'             => 'medical',
                    'category'         => $cat,
                    'patient_name'     => $u?->name ?? 'Walk-in Patient',
                    'student_id'       => $u?->student_id ?? ($u?->employee_id ?? Placeholder::EMPTY),
                    'role'             => $u?->role ?? 'student',
                    'service'          => ConsultationRow::serviceName($r),
                    'chief_complaint'  => $r->chief_complaint ?: Placeholder::EMPTY,
                    'diagnosis'        => $r->diagnosis ?: Placeholder::EMPTY,
                    'attending_staff'  => $r->createdBy?->name ?? 'Clinic Nurse',
                    'date'             => ConsultationRow::displayDate($vDate),
                    'raw_date'         => $vDate,
                ];
            }
        }

        // 2. Dental symptoms
        if (!$roleType || $roleType === 'dental') {
            $dentQuery = DentalConsultation::with(['patient.user', 'appointment.service', 'dentist'])
                ->where(function ($q) use ($dateFrom, $dateTo) {
                    $q->whereBetween('consultation_date', [$dateFrom, $dateTo])
                      ->orWhere(function ($sub) use ($dateFrom, $dateTo) {
                          $sub->whereNull('consultation_date')->whereBetween('created_at', ["{$dateFrom} 00:00:00", "{$dateTo} 23:59:59"]);
                      });
                });

            if ($serviceId && $serviceId !== 'all') {
                // match the service saved on the record, or the one of the linked appointment
                $svcName = (string) ClinicService::whereKey($serviceId)->value('name');
                $dentQuery->where(fn($sq) => $sq
                    ->whereHas('appointment', fn($a) => $a->where('service_id', $serviceId))
                    ->orWhere('service_name', $svcName));
            }
            if ($staffId && $staffId !== 'all') {
                $dentQuery->where('created_by', $staffId);
            }

            $dentRecords = $dentQuery->get();
            foreach ($dentRecords as $d) {
                $cat = $this->categorizeComplaint($d->complaint_category, $d->reason_for_visit, $d->diagnosis, 'dental');
                $categoryCounts[$cat] = ($categoryCounts[$cat] ?? 0) + 1;
                $totalSymptomsCount++;

                $u = $d->patient?->user;
                $vDate = ConsultationRow::day($d);
                $consultationLogs[] = [
                    'id'               => "dent-{$d->id}",
                    'type'             => 'dental',
                    'category'         => $cat,
                    'patient_name'     => $u?->name ?? 'Dental Patient',
                    'student_id'       => $u?->student_id ?? ($u?->employee_id ?? Placeholder::EMPTY),
                    'role'             => $u?->role ?? 'student',
                    'service'          => ConsultationRow::serviceName($d),
                    'chief_complaint'  => $d->reason_for_visit ?: Placeholder::EMPTY,
                    'diagnosis'        => $d->diagnosis ?: Placeholder::EMPTY,
                    'attending_staff'  => $d->dentist?->name ?? 'Dentist',
                    'date'             => $vDate ? Carbon::parse($vDate)->format('M j, Y') : Placeholder::EMPTY,
                    'raw_date'         => $vDate,
                ];
            }
        }

        arsort($categoryCounts);

        // All categories with percentages
        $allCategories = [];
        foreach ($categoryCounts as $catName => $count) {
            $pct = $totalSymptomsCount > 0 ? round(($count / $totalSymptomsCount) * 100, 1) : 0;
            $allCategories[] = [
                'name'       => $catName,
                'count'      => $count,
                'percentage' => $pct,
            ];
        }

        // Top 5 categories + Others (for pie chart, identical to Dashboard)
        $chartCategories = [];
        $othersCount = 0;
        $idx = 0;
        foreach ($categoryCounts as $catName => $count) {
            if ($idx < 5) {
                $pct = $totalSymptomsCount > 0 ? round(($count / $totalSymptomsCount) * 100, 1) : 0;
                $chartCategories[] = [
                    'name'       => $catName,
                    'count'      => $count,
                    'percentage' => $pct,
                ];
            } else {
                $othersCount += $count;
            }
            $idx++;
        }
        if ($othersCount > 0) {
            $chartCategories[] = [
                'name'       => 'Others',
                'count'      => $othersCount,
                'percentage' => $totalSymptomsCount > 0 ? round(($othersCount / $totalSymptomsCount) * 100, 1) : 0,
            ];
        }

        // Sort consultation logs by date descending
        usort($consultationLogs, fn($a, $b) => strcmp($b['raw_date'], $a['raw_date']));

        $staffQuery = User::orderBy('name');
        if ($roleType === 'dental') {
            $staffQuery->where('role', 'dentist');
        } elseif ($roleType === 'medical') {
            $staffQuery->where('role', 'clinic_staff');
        } else {
            $staffQuery->whereIn('role', ['clinic_staff', 'dentist']);
        }
        $staff = $staffQuery->get(['id', 'name']);
        $filterServices = ClinicService::orderBy('name')->get(['id', 'name']);

        return response()->json([
            'categories'      => $chartCategories,
            'all_categories'  => $allCategories,
            'total_logs'      => $totalSymptomsCount,
            'consultations'   => $consultationLogs,
            'filters'         => [
                'services'  => $filterServices,
                'staff'     => $staff,
                'date_from' => $dateFrom,
                'date_to'   => $dateTo,
            ],
        ]);
    }

    /**
     * POST /api/reports/log-export
     */
    public function logExport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'report'  => 'required|string',
            'format'  => 'required|string|in:pdf,csv',
            'filters' => 'nullable|array',
        ]);

        \App\Services\AuditLogger::log(
            'report_exported',
            null,
            null,
            null,
            [
                'report'  => $validated['report'],
                'format'  => strtoupper($validated['format']),
                'filters' => $validated['filters'] ?? [],
            ]
        );

        return response()->json(['message' => 'Export logged successfully.']);
    }

    /**
     * GET /api/reports/chat
     * Chat summary report: total conversations, resolved count, avg response time, etc.
     */
    public function chatSummary(Request $request): JsonResponse
    {
        $roleType = $request->query('role_type', 'all');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        $query = Conversation::query()->with(['messages.sender', 'student']);

        if ($roleType === 'medical' || $roleType === 'nurse') {
            $query->where('role', 'nurse');
        } elseif ($roleType === 'dental' || $roleType === 'dentist') {
            $query->where('role', 'dentist');
        }

        if ($dateFrom) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }
        if ($dateTo) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $conversations = $query->get();

        $total = $conversations->count();
        $resolved = $conversations->where('status', 'resolved')->count();
        $open = $conversations->where('status', 'open')->count();

        // Calculate avg response time (minutes)
        $responseTimes = [];
        $unanswered24h = 0;
        $now = Carbon::now();

        foreach ($conversations as $conv) {
            $firstStaffMsg = $conv->messages
                ->filter(function ($m) {
                    return $m->sender && in_array($m->sender->role, ['clinic_staff', 'dentist']);
                })
                ->sortBy('created_at')
                ->first();

            if ($firstStaffMsg) {
                $created = Carbon::parse($conv->created_at);
                $replied = Carbon::parse($firstStaffMsg->created_at);
                $diffMinutes = max(0, $created->diffInMinutes($replied));
                $responseTimes[] = $diffMinutes;
            } else {
                if ($conv->status === 'open' && Carbon::parse($conv->created_at)->diffInHours($now) >= 24) {
                    $unanswered24h++;
                }
            }
        }

        $avgResponseMinutes = count($responseTimes) > 0 ? round(array_sum($responseTimes) / count($responseTimes), 1) : 0;

        return response()->json([
            'total_conversations'       => $total,
            'resolved_conversations'    => $resolved,
            'open_conversations'        => $open,
            'avg_response_time_minutes' => $avgResponseMinutes,
            'unanswered_24h'            => $unanswered24h,
            'conversations'             => $conversations->map(function ($c) {
                return [
                    'id'              => $c->id,
                    'student_name'    => $c->student?->name ?? 'Unknown',
                    'student_id'      => $c->student?->id_number ?? Placeholder::EMPTY,
                    'role'            => $c->role,
                    'status'          => $c->status,
                    'created_at'      => $c->created_at?->format('Y-m-d H:i'),
                    'last_message_at' => $c->last_message_at?->format('Y-m-d H:i') ?? $c->updated_at?->format('Y-m-d H:i'),
                ];
            }),
        ]);
    }
}
