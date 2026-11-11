<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\CalendarEventController;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\ClinicRecord;
use App\Models\Conversation;
use App\Models\DentalConsultation;
use App\Models\InventoryBatch;
use App\Models\InventoryItem;
use App\Models\Patient;
use App\Models\User;
use App\Support\CacheVersion;
use App\Support\ConsultationRow;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * One endpoint per role returns everything its dashboard needs (stats, charts, recent visits,
 * alerts, calendar events), so a dashboard loads with a single request.
 *
 * Slow-changing numbers (charts, stock levels, student count) are cached for a short time under VERSIONED keys
 * (App\Support\CacheVersion): saving a consultation, changing stock or adding a user starts a new version, so the
 * dashboards are correct right after a save. Anything that must be fresh (today's appointments, recent visits,
 * conversation state) is always read live.
 */
class DashboardController extends Controller
{
    /** Seconds the chart data is cached (a consultation save refreshes it sooner). */
    private const CHART_TTL = 60;

    /** Seconds the stock levels and expiry counts are cached (a stock change refreshes it sooner). */
    private const STOCK_TTL = 60;

    /** Seconds the registered-student count is cached (a new / deactivated account refreshes it sooner). */
    private const STUDENT_COUNT_TTL = 300;

    /**
     * Map complaints and diagnoses into standardized category buckets.
     */
    private function categorizeComplaint(?string $category, ?string $complaint, ?string $diagnosis, string $type = 'medical'): string
    {
        if (!empty($category) && trim($category) !== '') {
            $cat = trim($category);
            return mb_strtolower($cat) === 'other' ? 'Others' : $cat;
        }

        $text = strtolower(trim(($complaint ?? '') . ' ' . ($diagnosis ?? '')));

        if (empty($text)) {
            return $type === 'dental' ? 'Dental Checkup' : 'Others';
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

        return 'Others';
    }

    /**
     * Restrict $query to consultations that happened in [$start, $end] (Y-m-d). A consultation
     * with no date counts on the day it was created. Written as plain ranges so the
     * date and created_at indexes can be used.
     */
    private function inRange($query, string $dateColumn, string $start, string $end)
    {
        return $query->where(function ($q) use ($dateColumn, $start, $end) {
            $q->whereBetween($dateColumn, [$start, $end])
              ->orWhere(function ($sub) use ($dateColumn, $start, $end) {
                  $sub->whereNull($dateColumn)->whereBetween('created_at', ["{$start} 00:00:00", "{$end} 23:59:59"]);
              });
        });
    }

    /** Dental consultations count only when completed (pending / cancelled ones did not take place). */
    private function onlyCompleted($query, string $table)
    {
        return $table === 'dental_consultations'
            ? $query->where(fn ($q) => $q->where('status', 'completed')->orWhereNull('status'))
            : $query;
    }

    /** The consultation tables a role's dashboard counts: [table, date column, text column, type, category id column]. */
    private function consultationSources(string $role): array
    {
        $sources = [];
        if ($role === 'admin' || $role === 'clinic_staff') {
            $sources[] = ['clinic_records', 'visit_date', 'chief_complaint', 'medical', 'complaint_category_id'];
        }
        if ($role === 'admin' || $role === 'dentist') {
            $sources[] = ['dental_consultations', 'consultation_date', 'reason_for_visit', 'dental', 'complaint_category_id'];
        }

        return $sources;
    }

    /**
     * Visits per calendar day between $start and $end: ['2026-11-04' => 3, ...].
     * One grouped query per table instead of one query per day / month.
     */
    private function visitsPerDay(string $role, string $start, string $end): array
    {
        $days = [];
        foreach ($this->consultationSources($role) as [$table, $dateColumn]) {
            $rows = $this->onlyCompleted($this->inRange(DB::table($table), $dateColumn, $start, $end), $table)
                ->selectRaw("COALESCE({$dateColumn}, DATE(created_at)) AS d, COUNT(*) AS c")
                ->groupBy('d')
                ->get();
            foreach ($rows as $row) {
                $days[$row->d] = ($days[$row->d] ?? 0) + (int) $row->c;
            }
        }

        return $days;
    }

    /**
     * Visit trends and frequent symptoms for a role and period (cached for CHART_TTL seconds).
     */
    private function getTrendsAndSymptoms(string $role, string $period, int $month, int $year, ?string $symptomType = null): array
    {
        // role is part of the key: each role's charts count different consultation tables
        $key = CacheVersion::key('dashboard', 'charts', $role, $period, (string) $month, (string) $year, (string) $symptomType, Carbon::today()->toDateString());

        return Cache::remember($key, self::CHART_TTL, fn () => $this->buildTrendsAndSymptoms($role, $period, $month, $year, $symptomType));
    }

    private function buildTrendsAndSymptoms(string $role, string $period, int $month, int $year, ?string $symptomType = null): array
    {
        $today = Carbon::today();
        $trendData = [];

        if ($period === 'daily') {
            $daysInMonth = Carbon::createFromDate($year, $month, 1)->daysInMonth;
            $startDate = sprintf('%04d-%02d-01', $year, $month);
            $endDate = sprintf('%04d-%02d-%02d', $year, $month, $daysInMonth);
            $perDay = $this->visitsPerDay($role, $startDate, $endDate);

            for ($d = 1; $d <= $daysInMonth; $d++) {
                $dateStr = sprintf('%04d-%02d-%02d', $year, $month, $d);
                $trendData[] = [
                    'date'        => $dateStr,
                    'label'       => Carbon::parse($dateStr)->format('M j'),
                    'short_label' => (string) $d,
                    'visits'      => $perDay[$dateStr] ?? 0,
                ];
            }
        } elseif ($period === 'yearly') {
            // Last 5 years
            $currentYear = $today->year;
            $startYear = $currentYear - 4;
            $startDate = "{$startYear}-01-01";
            $endDate = "{$currentYear}-12-31";
            $perDay = $this->visitsPerDay($role, $startDate, $endDate);

            $perYear = [];
            foreach ($perDay as $day => $count) {
                $perYear[(int) substr($day, 0, 4)] = ($perYear[(int) substr($day, 0, 4)] ?? 0) + $count;
            }
            for ($y = $startYear; $y <= $currentYear; $y++) {
                $trendData[] = [
                    'label'       => (string) $y,
                    'short_label' => (string) $y,
                    'visits'      => $perYear[$y] ?? 0,
                ];
            }
        } else {
            // Monthly: 12 months of the selected year (default)
            $startDate = "{$year}-01-01";
            $endDate = "{$year}-12-31";
            $perDay = $this->visitsPerDay($role, $startDate, $endDate);

            $perMonth = [];
            foreach ($perDay as $day => $count) {
                $perMonth[(int) substr($day, 5, 2)] = ($perMonth[(int) substr($day, 5, 2)] ?? 0) + $count;
            }
            for ($m = 1; $m <= 12; $m++) {
                $monthName = Carbon::createFromDate($year, $m, 1)->format('M');
                $trendData[] = [
                    'label'       => $monthName,
                    'short_label' => $monthName,
                    'visits'      => $perMonth[$m] ?? 0,
                ];
            }
        }

        // Frequent symptoms in the same range. Identical complaint/diagnosis text is grouped in
        // SQL so only the distinct combinations are categorised in PHP.
        // Category names come from the complaint_categories table (by id, then by name);
        // rows without a category still fall back to keyword matching.
        $categoryCounts = [];
        $totalSymptomsCount = 0;
        $uncategorizedCount = 0;

        $catById   = DB::table('complaint_categories')->pluck('name', 'id')->all();
        $catByName = [];
        foreach ($catById as $catName) {
            $catByName[mb_strtolower($catName)] = $catName;
        }

        $resolveCategory = function ($row, string $type) use ($catById, $catByName): string {
            $cid = $row->complaint_category_id ?? null;
            if ($cid !== null && isset($catById[$cid])) {
                return $catById[$cid];
            }

            $cat = trim((string) ($row->complaint_category ?? ''));
            if ($cat !== '') {
                $key = mb_strtolower($cat);
                if ($key === 'other') {
                    $key = 'others';   // merge the legacy "Other" into "Others"
                }

                return $catByName[$key] ?? $cat;
            }

            return $this->categorizeComplaint(null, $row->complaint, $row->diagnosis, $type);
        };

        foreach ($this->consultationSources($role) as [$table, $dateColumn, $textColumn, $type, $categoryIdColumn]) {
            if ($symptomType !== null && $type !== $symptomType) {
                continue;   // admin's symptoms toggle: count only the asked-for care type
            }
            $query = $this->onlyCompleted($this->inRange(DB::table($table), $dateColumn, $startDate, $endDate), $table)
                ->select('complaint_category', "{$textColumn} AS complaint", 'diagnosis')
                ->selectRaw($categoryIdColumn ? "{$categoryIdColumn} AS complaint_category_id, COUNT(*) AS c" : 'NULL AS complaint_category_id, COUNT(*) AS c')
                ->groupBy('complaint_category', $textColumn, 'diagnosis');
            if ($categoryIdColumn) {
                $query->groupBy($categoryIdColumn);
            }
            $rows = $query->get();

            foreach ($rows as $row) {
                $cat = $resolveCategory($row, $type);
                $categoryCounts[$cat] = ($categoryCounts[$cat] ?? 0) + (int) $row->c;
                $totalSymptomsCount += (int) $row->c;

                // Catch-all buckets only count as uncategorized when the record stored no category at all
                // (a real "Others" pick must not be lumped in with unmatched consultations)
                $hasStoredCategory = ($row->complaint_category_id !== null && $row->complaint_category_id !== '')
                    || trim((string) ($row->complaint_category ?? '')) !== '';
                if (! $hasStoredCategory && ($cat === 'Others' || $cat === 'Dental Checkup')) {
                    $uncategorizedCount += (int) $row->c;
                }
            }
        }

        arsort($categoryCounts);

        // Top 5 categories + Others
        $frequentSymptoms = [];
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
            'categorized_consultations' => max(0, $totalSymptomsCount - $uncategorizedCount),
        ];
    }

    /**
     * Latest consultation visits with patient, service, complaint and staff.
     * Always read live, and only the 8 newest rows of each table are loaded.
     */
    private function getRecentVisits(string $role, int $limit = 8): array
    {
        $visits = collect();

        if ($role === 'admin' || $role === 'clinic_staff') {
            $med = ClinicRecord::with(['patient.user', 'createdBy'])
                ->orderByDesc('visit_date')
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get()
                ->map(fn ($r) => ConsultationRow::medical($r));
            $visits = $visits->merge($med);
        }

        if ($role === 'admin' || $role === 'dentist') {
            $dent = DentalConsultation::with(['patient.user', 'dentist'])
                ->orderByDesc('consultation_date')
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get()
                ->map(fn ($c) => ConsultationRow::dental($c));
            $visits = $visits->merge($dent);
        }

        // Sort merged visits by raw_date/created_at descending and take 8
        return $visits
            ->sortByDesc(fn ($v) => $v['raw_date'] . ' ' . $v['created_at'])
            ->values()
            ->take($limit)
            ->all();
    }

    /**
     * Stock levels, low-stock counts per dashboard and the expiring-soon count, from two
     * aggregate queries (cached for STOCK_TTL seconds). It replaces a loop that ran two
     * queries for every inventory item, twice per dashboard.
     *
     * low_stock          every active non-equipment item (admin, alert banner)
     * low_stock_med      active medicines and supplies (nurse)
     * low_stock_supply   active supplies (dentist)
     */
    private function stockSnapshot(): array
    {
        return Cache::remember(CacheVersion::key('stock', 'snapshot', Carbon::today()->toDateString()), self::STOCK_TTL, function () {
            $stock = DB::table('inventory_transactions')
                ->selectRaw("item_id, SUM(CASE WHEN type = 'IN' THEN quantity WHEN type = 'OUT' THEN -quantity ELSE 0 END) AS stock")
                ->groupBy('item_id')
                ->pluck('stock', 'item_id');

            $low = ['low_stock' => 0, 'low_stock_med' => 0, 'low_stock_supply' => 0];
            foreach (InventoryItem::where('is_active', true)->get(['id', 'category', 'reorder_level']) as $item) {
                if (max(0, (int) ($stock[$item->id] ?? 0)) > $item->reorder_level) {
                    continue;
                }
                if ($item->category !== null && $item->category !== 'Equipment') {
                    $low['low_stock']++;
                }
                if (in_array($item->category, ['Medicine', 'Supply'], true)) {
                    $low['low_stock_med']++;
                }
                if ($item->category === 'Supply') {
                    $low['low_stock_supply']++;
                }
            }

            $today = Carbon::today()->toDateString();
            $in30Days = Carbon::today()->addDays(30)->toDateString();
            $low['expiring_soon'] = InventoryBatch::whereNotNull('expiry_date')
                ->where('quantity_in', '>', DB::raw('quantity_used'))
                ->where('expiry_date', '>', $today)
                ->where('expiry_date', '<=', $in30Days)
                ->count();

            return $low;
        });
    }

    /** Low stock + expiring soon, for the inventory alert banner. */
    private function getInventoryAlertSummary(): array
    {
        $snapshot = $this->stockSnapshot();

        return [
            'low_stock'     => $snapshot['low_stock'],
            'expiring_soon' => $snapshot['expiring_soon'],
            'total'         => $snapshot['low_stock'] + $snapshot['expiring_soon'],
        ];
    }

    /** [start, end] of today as datetime strings, for index-friendly range queries on timestamps. */
    private function todayBounds(): array
    {
        return [Carbon::today()->startOfDay()->toDateTimeString(), Carbon::today()->endOfDay()->toDateTimeString()];
    }

    /** Consultations recorded today (by visit date, or created today) in one table. */
    private function consultationsToday(string $model, string $dateColumn): int
    {
        $today = Carbon::today()->toDateString();
        [$from, $to] = $this->todayBounds();

        $query = $model === DentalConsultation::class ? $model::completed() : $model::query();

        return $query->where(function ($q) use ($dateColumn, $today, $from, $to) {
            $q->where($dateColumn, $today)->orWhereBetween('created_at', [$from, $to]);
        })->count();
    }

    /**
     * GET /api/dashboard/admin
     * Restricted to admin.
     */
    public function admin(Request $request): JsonResponse
    {
        $period = $request->query('period', 'monthly'); // 'daily' | 'monthly' | 'yearly'
        $month = (int) $request->query('month', Carbon::today()->month);
        $year = (int) $request->query('year', Carbon::today()->year);
        // Optional symptoms-chart filter: 'medical' | 'dental' (default: both)
        $symptomType = $request->query('type');
        $symptomType = is_string($symptomType) && in_array($symptomType, ['medical', 'dental'], true) ? $symptomType : null;
        [$from, $to] = $this->todayBounds();

        // 1. Stats cards
        $todayAppointments = Appointment::whereBetween('scheduled_at', [$from, $to])->count();
        $consultationsToday = $this->consultationsToday(ClinicRecord::class, 'visit_date')
            + $this->consultationsToday(DentalConsultation::class, 'consultation_date');
        $registeredStudents = Cache::remember(CacheVersion::key('users', 'registered-students'), self::STUDENT_COUNT_TTL, fn () => User::where('role', 'student')->count());
        $invAlerts = $this->getInventoryAlertSummary();

        // Unanswered conversations count (open with no staff reply in 24h). Conversation state is never cached.
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
                'consultations_today'       => $consultationsToday,
                'registered_students'       => $registeredStudents,
                'inventory_alerts'          => $invAlerts['total'],
                'unanswered_conversations'  => $unansweredConversations,
            ],
            'inventory_alert' => $invAlerts,
            'charts'          => $this->getTrendsAndSymptoms('admin', $period, $month, $year, $symptomType),
            'recent_visits'   => $this->getRecentVisits('admin', 8),
            'calendar_events' => CalendarEventController::visibleEvents($request->user()),
        ]);
    }

    /**
     * GET /api/dashboard/nurse
     * Accessible by clinic_staff and admin.
     */
    public function nurse(Request $request): JsonResponse
    {
        $user = $request->user();
        $period = $request->query('period', 'monthly');
        $month = (int) $request->query('month', Carbon::today()->month);
        $year = (int) $request->query('year', Carbon::today()->year);
        [$from, $to] = $this->todayBounds();

        // Today's medical appointments: mine (or unassigned) and still waiting, in one query
        $appts = Appointment::where('appointment_type', 'medical')
            ->whereBetween('scheduled_at', [$from, $to])
            ->selectRaw("COALESCE(SUM(CASE WHEN staff_id = ? OR staff_id IS NULL THEN 1 ELSE 0 END), 0) AS mine, COALESCE(SUM(CASE WHEN status IN ('confirmed', 'pending') THEN 1 ELSE 0 END), 0) AS waiting", [$user->id])
            ->first();

        return response()->json([
            'stats' => [
                'my_appointments_today'         => (int) $appts->mine,
                'waiting_patients'              => (int) $appts->waiting,
                'consultations_completed_today' => $this->consultationsToday(ClinicRecord::class, 'visit_date'),
                'low_stock_items'               => $this->stockSnapshot()['low_stock_med'],
            ],
            'inventory_alert' => $this->getInventoryAlertSummary(),
            'charts'          => $this->getTrendsAndSymptoms('clinic_staff', $period, $month, $year),
            'recent_visits'   => $this->getRecentVisits('clinic_staff', 8),
            'calendar_events' => CalendarEventController::visibleEvents($user),
        ]);
    }

    /**
     * GET /api/dashboard/dentist
     * Accessible by dentist and admin.
     */
    public function dentist(Request $request): JsonResponse
    {
        $user = $request->user();
        $period = $request->query('period', 'monthly');
        $month = (int) $request->query('month', Carbon::today()->month);
        $year = (int) $request->query('year', Carbon::today()->year);
        [$from, $to] = $this->todayBounds();

        $appts = Appointment::where('appointment_type', 'dental')
            ->whereBetween('scheduled_at', [$from, $to])
            ->selectRaw("COUNT(*) AS total, COALESCE(SUM(CASE WHEN status IN ('confirmed', 'pending') THEN 1 ELSE 0 END), 0) AS waiting")
            ->first();

        return response()->json([
            'stats' => [
                'my_dental_appointments_today'         => (int) $appts->total,
                'waiting_patients'                     => (int) $appts->waiting,
                'dental_consultations_completed_today' => $this->consultationsToday(DentalConsultation::class, 'consultation_date'),
                'dental_supplies_low_stock'            => $this->stockSnapshot()['low_stock_supply'],
            ],
            'inventory_alert' => $this->getInventoryAlertSummary(),
            'charts'          => $this->getTrendsAndSymptoms('dentist', $period, $month, $year),
            'recent_visits'   => $this->getRecentVisits('dentist', 8),
            'calendar_events' => CalendarEventController::visibleEvents($user),
        ]);
    }

    /**
     * GET /api/dashboard/student
     * Student and faculty/staff dashboard: counts, the appointments around today (for the
     * upcoming list and the calendar), recent notifications, announcements and calendar events.
     */
    public function student(Request $request): JsonResponse
    {
        $user = $request->user();
        $patientId = Patient::where('user_id', $user->id)->value('id');

        $appointments = collect();
        $upcomingCount = 0;
        $completedVisits = 0;

        if ($patientId) {
            $upcomingCount = Appointment::where('patient_id', $patientId)->whereIn('status', ['pending', 'confirmed'])->count();
            $completedVisits = ClinicRecord::where('patient_id', $patientId)->count();

            // Six months either side of today covers the list, the next appointment and the calendar.
            $appointments = Appointment::where('patient_id', $patientId)
                ->whereBetween('scheduled_at', [Carbon::now()->subMonths(6), Carbon::now()->addMonths(6)])
                ->with(['service:id,name', 'staff:id,name'])
                ->orderBy('scheduled_at')
                ->limit(150)
                ->get(['id', 'patient_id', 'service_id', 'staff_id', 'scheduled_at', 'status', 'appointment_type']);
        }

        $notifications = NotificationController::visibleQuery($user);
        $unreadNotifications = (clone $notifications)->where('is_read', false)->count();
        $recentNotifications = NotificationController::recent($notifications, 12);

        return response()->json([
            'stats' => [
                'upcoming_appointments' => $upcomingCount,
                'completed_visits'      => $completedVisits,
                'unread_notifications'  => $unreadNotifications,
            ],
            'appointments'    => $appointments,
            'notifications'   => $recentNotifications,
            'announcements'   => AnnouncementController::latestFor($user, 10),
            'calendar_events' => CalendarEventController::visibleEvents($user),
        ]);
    }
}
