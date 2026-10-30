<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\ClinicRecord;
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

class DashboardController extends Controller
{
    /**
     * Helper to compute stock for an item.
     */
    private function getItemStock(int $itemId): int
    {
        $in  = InventoryTransaction::where('item_id', $itemId)->where('type', 'IN')->sum('quantity');
        $out = InventoryTransaction::where('item_id', $itemId)->where('type', 'OUT')->sum('quantity');
        return max(0, $in - $out);
    }

    /**
     * Map complaints and diagnoses into standardized category buckets.
     */
    private function categorizeComplaint(?string $category, ?string $complaint, ?string $diagnosis, string $type = 'medical'): string
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
     * Compute visit trends over time and frequent symptoms for a specific role and date period.
     */
    private function getTrendsAndSymptoms(string $role, string $period, int $month, int $year): array
    {
        $today = Carbon::today();
        $labels = [];
        $trendData = [];
        $startDate = null;
        $endDate = null;

        if ($period === 'daily') {
            // Days of the selected month
            $daysInMonth = Carbon::createFromDate($year, $month, 1)->daysInMonth;
            $startDate = Carbon::createFromDate($year, $month, 1)->startOfDay()->toDateString();
            $endDate = Carbon::createFromDate($year, $month, $daysInMonth)->endOfDay()->toDateString();

            for ($d = 1; $d <= $daysInMonth; $d++) {
                $dateStr = sprintf('%04d-%02d-%02d', $year, $month, $d);
                $label = Carbon::parse($dateStr)->format('M j');
                $shortLabel = (string) $d;

                $count = 0;
                if ($role === 'admin' || $role === 'clinic_staff') {
                    $count += ClinicRecord::where(function ($q) use ($dateStr) {
                        $q->whereDate('visit_date', $dateStr)
                          ->orWhere(function ($sub) use ($dateStr) {
                              $sub->whereNull('visit_date')->whereDate('created_at', $dateStr);
                          });
                    })->count();
                }
                if ($role === 'admin' || $role === 'dentist') {
                    $count += DentalConsultation::where(function ($q) use ($dateStr) {
                        $q->whereDate('consultation_date', $dateStr)
                          ->orWhere(function ($sub) use ($dateStr) {
                              $sub->whereNull('consultation_date')->whereDate('created_at', $dateStr);
                          });
                    })->count();
                }

                $trendData[] = [
                    'date'        => $dateStr,
                    'label'       => $label,
                    'short_label' => $shortLabel,
                    'visits'      => $count,
                ];
            }
        } elseif ($period === 'yearly') {
            // Last 5 years
            $currentYear = $today->year;
            $startYear = $currentYear - 4;
            $startDate = Carbon::createFromDate($startYear, 1, 1)->startOfDay()->toDateString();
            $endDate = Carbon::createFromDate($currentYear, 12, 31)->endOfDay()->toDateString();

            for ($y = $startYear; $y <= $currentYear; $y++) {
                $yStart = "{$y}-01-01";
                $yEnd = "{$y}-12-31";

                $count = 0;
                if ($role === 'admin' || $role === 'clinic_staff') {
                    $count += ClinicRecord::where(function ($q) use ($yStart, $yEnd) {
                        $q->whereBetween('visit_date', [$yStart, $yEnd])
                          ->orWhere(function ($sub) use ($yStart, $yEnd) {
                              $sub->whereNull('visit_date')->whereBetween('created_at', ["{$yStart} 00:00:00", "{$yEnd} 23:59:59"]);
                          });
                    })->count();
                }
                if ($role === 'admin' || $role === 'dentist') {
                    $count += DentalConsultation::where(function ($q) use ($yStart, $yEnd) {
                        $q->whereBetween('consultation_date', [$yStart, $yEnd])
                          ->orWhere(function ($sub) use ($yStart, $yEnd) {
                              $sub->whereNull('consultation_date')->whereBetween('created_at', ["{$yStart} 00:00:00", "{$yEnd} 23:59:59"]);
                          });
                    })->count();
                }

                $trendData[] = [
                    'label'       => (string) $y,
                    'short_label' => (string) $y,
                    'visits'      => $count,
                ];
            }
        } else {
            // Monthly: 12 months of the selected year (default)
            $startDate = Carbon::createFromDate($year, 1, 1)->startOfDay()->toDateString();
            $endDate = Carbon::createFromDate($year, 12, 31)->endOfDay()->toDateString();

            for ($m = 1; $m <= 12; $m++) {
                $mStart = sprintf('%04d-%02d-01', $year, $m);
                $daysInM = Carbon::createFromDate($year, $m, 1)->daysInMonth;
                $mEnd = sprintf('%04d-%02d-%02d', $year, $m, $daysInM);
                $monthName = Carbon::createFromDate($year, $m, 1)->format('M');

                $count = 0;
                if ($role === 'admin' || $role === 'clinic_staff') {
                    $count += ClinicRecord::where(function ($q) use ($mStart, $mEnd) {
                        $q->whereBetween('visit_date', [$mStart, $mEnd])
                          ->orWhere(function ($sub) use ($mStart, $mEnd) {
                              $sub->whereNull('visit_date')->whereBetween('created_at', ["{$mStart} 00:00:00", "{$mEnd} 23:59:59"]);
                          });
                    })->count();
                }
                if ($role === 'admin' || $role === 'dentist') {
                    $count += DentalConsultation::where(function ($q) use ($mStart, $mEnd) {
                        $q->whereBetween('consultation_date', [$mStart, $mEnd])
                          ->orWhere(function ($sub) use ($mStart, $mEnd) {
                              $sub->whereNull('consultation_date')->whereBetween('created_at', ["{$mStart} 00:00:00", "{$mEnd} 23:59:59"]);
                          });
                    })->count();
                }

                $trendData[] = [
                    'label'       => $monthName,
                    'short_label' => $monthName,
                    'visits'      => $count,
                ];
            }
        }

        // 2. Compute Frequent Symptoms in that range
        $categoryCounts = [];
        $totalSymptomsCount = 0;

        if ($role === 'admin' || $role === 'clinic_staff') {
            $medQuery = ClinicRecord::query();
            if ($startDate && $endDate) {
                $medQuery->where(function ($q) use ($startDate, $endDate) {
                    $q->whereBetween('visit_date', [$startDate, $endDate])
                      ->orWhere(function ($sub) use ($startDate, $endDate) {
                          $sub->whereNull('visit_date')->whereBetween('created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"]);
                      });
                });
            }
            $medRecords = $medQuery->get(['complaint_category', 'chief_complaint', 'diagnosis']);
            foreach ($medRecords as $r) {
                $cat = $this->categorizeComplaint($r->complaint_category, $r->chief_complaint, $r->diagnosis, 'medical');
                $categoryCounts[$cat] = ($categoryCounts[$cat] ?? 0) + 1;
                $totalSymptomsCount++;
            }
        }

        if ($role === 'admin' || $role === 'dentist') {
            $dentQuery = DentalConsultation::query();
            if ($startDate && $endDate) {
                $dentQuery->where(function ($q) use ($startDate, $endDate) {
                    $q->whereBetween('consultation_date', [$startDate, $endDate])
                      ->orWhere(function ($sub) use ($startDate, $endDate) {
                          $sub->whereNull('consultation_date')->whereBetween('created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"]);
                      });
                });
            }
            $dentRecords = $dentQuery->get(['complaint_category', 'reason_for_visit', 'diagnosis']);
            foreach ($dentRecords as $d) {
                $cat = $this->categorizeComplaint($d->complaint_category, $d->reason_for_visit, $d->diagnosis, 'dental');
                $categoryCounts[$cat] = ($categoryCounts[$cat] ?? 0) + 1;
                $totalSymptomsCount++;
            }
        }

        // Sort descending
        arsort($categoryCounts);

        // Top 5 categories + Others
        $frequentSymptoms = [];
        $top5 = array_slice($categoryCounts, 0, 5, true);
        $othersCount = 0;

        $index = 0;
        foreach ($categoryCounts as $catName => $count) {
            if ($index < 5) {
                $pct = $totalSymptomsCount > 0 ? round(($count / $totalSymptomsCount) * 100, 1) : 0;
                $frequentSymptoms[] = [
                    'name'       => $catName,
                    'count'      => $count,
                    'percentage' => $pct,
                ];
            } else {
                $othersCount += $count;
            }
            $index++;
        }

        if ($othersCount > 0) {
            $frequentSymptoms[] = [
                'name'       => 'Others',
                'count'      => $othersCount,
                'percentage' => $totalSymptomsCount > 0 ? round(($othersCount / $totalSymptomsCount) * 100, 1) : 0,
            ];
        }

        return [
            'period'             => $period,
            'selected_month'     => $month,
            'selected_year'      => $year,
            'visit_trends'       => $trendData,
            'frequent_symptoms'  => $frequentSymptoms,
            'total_consultations'=> $totalSymptomsCount,
        ];
    }

    /**
     * Get latest 8 consultation visits with student/patient details, service, complaint, and staff.
     */
    private function getRecentVisits(string $role, int $limit = 8): array
    {
        $visits = collect();

        if ($role === 'admin' || $role === 'clinic_staff') {
            $med = ClinicRecord::with(['patient.user', 'appointment.service', 'createdBy'])
                ->orderByDesc('visit_date')
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get()
                ->map(function ($r) {
                    $u = $r->patient?->user;
                    $vDate = $r->visit_date ? Carbon::parse($r->visit_date)->toDateString() : ($r->created_at ? $r->created_at->toDateString() : '');
                    $formattedDate = $vDate ? Carbon::parse($vDate)->format('M j, Y') : '—';
                    $complaintText = $r->complaint_category ?: ($r->chief_complaint ?: ($r->diagnosis ?: 'General Consultation'));

                    return [
                        'id'                  => "med-{$r->id}",
                        'record_id'           => $r->id,
                        'type'                => 'medical',
                        'patient_id'          => $r->patient_id,
                        'patient_user_id'     => $u?->id,
                        'student_name'        => $u?->name ?? 'Walk-in Patient',
                        'student_id'          => $u?->student_id ?? '—',
                        'role'                => $u?->role ?? 'student',
                        'service'             => $r->appointment?->service?->name ?? 'Medical Consultation',
                        'complaint_diagnosis' => $complaintText,
                        'status'              => 'Completed',
                        'attending_staff'     => $r->createdBy?->name ?? 'Clinic Nurse',
                        'date'                => $formattedDate,
                        'raw_date'            => $vDate,
                        'created_at'          => $r->created_at?->toISOString(),
                    ];
                });
            $visits = $visits->merge($med);
        }

        if ($role === 'admin' || $role === 'dentist') {
            $dent = DentalConsultation::with(['patient.user', 'appointment.service', 'dentist'])
                ->orderByDesc('consultation_date')
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get()
                ->map(function ($c) {
                    $u = $c->patient?->user;
                    $vDate = $c->consultation_date ? Carbon::parse($c->consultation_date)->toDateString() : ($c->created_at ? $c->created_at->toDateString() : '');
                    $formattedDate = $vDate ? Carbon::parse($vDate)->format('M j, Y') : '—';
                    $complaintText = $c->complaint_category ?: ($c->reason_for_visit ?: ($c->diagnosis ?: 'Dental Examination'));

                    return [
                        'id'                  => "dent-{$c->id}",
                        'record_id'           => $c->id,
                        'type'                => 'dental',
                        'patient_id'          => $c->patient_id,
                        'patient_user_id'     => $u?->id,
                        'student_name'        => $u?->name ?? 'Dental Patient',
                        'student_id'          => $u?->student_id ?? '—',
                        'role'                => $u?->role ?? 'student',
                        'service'             => $c->appointment?->service?->name ?? ($c->diagnosis ?: 'Dental Consultation'),
                        'complaint_diagnosis' => $complaintText,
                        'status'              => 'Completed',
                        'attending_staff'     => $c->dentist?->name ?? 'Dentist',
                        'date'                => $formattedDate,
                        'raw_date'            => $vDate,
                        'created_at'          => $c->created_at?->toISOString(),
                    ];
                });
            $visits = $visits->merge($dent);
        }

        // Sort merged visits by raw_date/created_at descending and take 8
        return $visits
            ->sortByDesc(fn($v) => $v['raw_date'] . ' ' . $v['created_at'])
            ->values()
            ->take($limit)
            ->all();
    }

    /**
     * Compute inventory alert counts and banner info.
     */
    private function getInventoryAlertSummary(): array
    {
        $today = Carbon::today()->toDateString();
        $in30Days = Carbon::today()->addDays(30)->toDateString();

        $items = InventoryItem::where('category', '!=', 'Equipment')->where('is_active', true)->get();
        $lowStock = 0;
        foreach ($items as $item) {
            if ($this->getItemStock($item->id) <= $item->reorder_level) {
                $lowStock++;
            }
        }

        $expiringSoon = InventoryBatch::whereNotNull('expiry_date')
            ->where('quantity_in', '>', DB::raw('quantity_used'))
            ->where('expiry_date', '>', $today)
            ->where('expiry_date', '<=', $in30Days)
            ->count();

        return [
            'low_stock'     => $lowStock,
            'expiring_soon' => $expiringSoon,
            'total'         => $lowStock + $expiringSoon,
        ];
    }

    /**
     * GET /api/dashboard/admin
     * Restricted to admin.
     */
    public function admin(Request $request): JsonResponse
    {
        $today = Carbon::today()->toDateString();
        $period = $request->query('period', 'monthly'); // 'daily' | 'monthly' | 'yearly'
        $month = (int) $request->query('month', Carbon::today()->month);
        $year = (int) $request->query('year', Carbon::today()->year);

        // 1. Stats Cards
        $todayAppointments = Appointment::whereDate('scheduled_at', $today)->count();
        $consultationsToday = ClinicRecord::whereDate('visit_date', $today)
            ->orWhereDate('created_at', $today)
            ->count()
            + DentalConsultation::whereDate('consultation_date', $today)
            ->orWhereDate('created_at', $today)
            ->count();
        $registeredStudents = User::where('role', 'student')->count();
        $invAlerts = $this->getInventoryAlertSummary();

        // 2. Charts & Frequent Symptoms
        $chartData = $this->getTrendsAndSymptoms('admin', $period, $month, $year);

        // 3. Recent Visits table (Latest 8 rows)
        $recentVisits = $this->getRecentVisits('admin', 8);

        // Unanswered conversations count (open with no staff reply in 24h)
        $unansweredConversations = Conversation::where('status', 'open')
            ->where('created_at', '<', Carbon::now()->subHours(24))
            ->whereDoesntHave('messages', function ($q) {
                $q->whereHas('sender', function ($sq) {
                    $sq->whereIn('role', ['clinic_staff', 'dentist']);
                });
            })
            ->count();

        return response()->json([
            'stats' => [
                'today_appointments'        => $todayAppointments,
                'consultations_today'      => $consultationsToday,
                'registered_students'      => $registeredStudents,
                'inventory_alerts'         => $invAlerts['total'],
                'unanswered_conversations' => $unansweredConversations,
            ],
            'inventory_alert'   => $invAlerts,
            'charts'            => $chartData,
            'recent_visits'     => $recentVisits,
        ]);
    }

    /**
     * GET /api/dashboard/nurse
     * Accessible by clinic_staff and admin.
     */
    public function nurse(Request $request): JsonResponse
    {
        $user = $request->user();
        $today = Carbon::today()->toDateString();
        $period = $request->query('period', 'monthly');
        $month = (int) $request->query('month', Carbon::today()->month);
        $year = (int) $request->query('year', Carbon::today()->year);

        // 1. 4 Stat Cards
        $myAppointmentsToday = Appointment::where('appointment_type', 'medical')
            ->whereDate('scheduled_at', $today)
            ->where(function ($q) use ($user) {
                if ($user) {
                    $q->where('staff_id', $user->id)
                      ->orWhereNull('staff_id');
                }
            })
            ->count();

        $waitingPatients = Appointment::where('appointment_type', 'medical')
            ->whereDate('scheduled_at', $today)
            ->whereIn('status', ['confirmed', 'pending'])
            ->count();

        $consultationsCompletedToday = ClinicRecord::where(function ($q) use ($today) {
                $q->whereDate('visit_date', $today)
                  ->orWhereDate('created_at', $today);
            })
            ->count();

        $medItems = InventoryItem::whereIn('category', ['Medicine', 'Supply'])->where('is_active', true)->get();
        $lowStockCount = 0;
        foreach ($medItems as $item) {
            if ($this->getItemStock($item->id) <= $item->reorder_level) {
                $lowStockCount++;
            }
        }

        $invAlerts = $this->getInventoryAlertSummary();

        // 2. Charts (Medical only)
        $chartData = $this->getTrendsAndSymptoms('clinic_staff', $period, $month, $year);

        // 3. Recent Visits table (Medical only, latest 8)
        $recentVisits = $this->getRecentVisits('clinic_staff', 8);

        return response()->json([
            'stats' => [
                'my_appointments_today'         => $myAppointmentsToday,
                'waiting_patients'              => $waitingPatients,
                'consultations_completed_today' => $consultationsCompletedToday,
                'low_stock_items'               => $lowStockCount,
            ],
            'inventory_alert' => $invAlerts,
            'charts'          => $chartData,
            'recent_visits'   => $recentVisits,
        ]);
    }

    /**
     * GET /api/dashboard/dentist
     * Accessible by dentist and admin.
     */
    public function dentist(Request $request): JsonResponse
    {
        $user = $request->user();
        $today = Carbon::today()->toDateString();
        $period = $request->query('period', 'monthly');
        $month = (int) $request->query('month', Carbon::today()->month);
        $year = (int) $request->query('year', Carbon::today()->year);

        // 1. 4 Stat Cards
        $myDentalAppointmentsToday = Appointment::where('appointment_type', 'dental')
            ->whereDate('scheduled_at', $today)
            ->count();

        $waitingPatients = Appointment::where('appointment_type', 'dental')
            ->whereDate('scheduled_at', $today)
            ->whereIn('status', ['confirmed', 'pending'])
            ->count();

        $dentalConsultationsCompletedToday = DentalConsultation::where(function ($q) use ($today) {
                $q->whereDate('consultation_date', $today)
                  ->orWhereDate('created_at', $today);
            })
            ->count();

        $supplyItems = InventoryItem::where('category', 'Supply')->where('is_active', true)->get();
        $dentalSuppliesLowStock = 0;
        foreach ($supplyItems as $item) {
            if ($this->getItemStock($item->id) <= $item->reorder_level) {
                $dentalSuppliesLowStock++;
            }
        }

        $invAlerts = $this->getInventoryAlertSummary();

        // 2. Charts (Dental only)
        $chartData = $this->getTrendsAndSymptoms('dentist', $period, $month, $year);

        // 3. Recent Visits table (Dental only, latest 8)
        $recentVisits = $this->getRecentVisits('dentist', 8);

        return response()->json([
            'stats' => [
                'my_dental_appointments_today'         => $myDentalAppointmentsToday,
                'waiting_patients'                     => $waitingPatients,
                'dental_consultations_completed_today' => $dentalConsultationsCompletedToday,
                'dental_supplies_low_stock'            => $dentalSuppliesLowStock,
            ],
            'inventory_alert' => $invAlerts,
            'charts'          => $chartData,
            'recent_visits'   => $recentVisits,
        ]);
    }
}
