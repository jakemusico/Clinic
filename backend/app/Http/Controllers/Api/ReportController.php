<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\ClinicRecord;
use App\Models\ClinicService;
use App\Models\ComplaintCategory;
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
use App\Support\ComplaintCategoryResolver;
use App\Support\EncryptedFields;
use App\Support\Placeholder;
use App\Support\Roles;
use App\Support\CacheVersion;
use Illuminate\Support\Facades\Cache;

class ReportController extends Controller
{
    /**
     * Most rows a report list may hold. A month of data is a few hundred rows, so this is only a safety
     * stop against a very wide date range loading a whole table into memory.
     */
    private const ROW_CAP = 10000;

    /**
     * Categorize a complaint/diagnosis into standard categories (matches DashboardController).
     */
    public function categorizeComplaint(?string $category, ?string $complaint, ?string $diagnosis, string $type = 'medical'): string
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
     * The one kind of care a report is limited to: 'medical' for the nurse, 'dental' for the dentist.
     * Admin sees both (null), or narrows it to one with ?type=medical|dental.
     */
    private function careTypeFor(?User $user, mixed $requested): ?string
    {
        $types = Roles::careTypes($user);

        if (count($types) === 1) {
            return $types[0];
        }

        return is_string($requested) && in_array($requested, $types, true) ? $requested : null;
    }

    /**
     * Current stock (IN minus OUT, never below 0) of EVERY item from one grouped query, keyed by item id.
     *
     * @return array<int,int>
     */
    private function stockByItem(): array
    {
        return InventoryTransaction::query()
            ->selectRaw("item_id, SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END) AS stock")
            ->groupBy('item_id')
            ->pluck('stock', 'item_id')
            ->map(fn ($v) => max(0, (int) $v))
            ->all();
    }

    /**
     * GET /api/reports/appointments
     */
    public function appointmentSummary(Request $request): JsonResponse
    {
        // Validate date parameters (fix #3)
        $request->validate([
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to'   => ['nullable', 'date_format:Y-m-d'],
        ]);

        $user = $request->user();
        if (! Roles::isClinicStaff($user)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        // nurse: medical only, dentist: dental only, admin: both (or the one asked for with ?type=)
        $roleType = $this->careTypeFor($user, $request->query('type'));

        $dateFrom = $request->query('date_from', Carbon::now()->startOfMonth()->toDateString());
        $dateTo   = $request->query('date_to', Carbon::now()->endOfMonth()->toDateString());
        $perPage  = min(100, max(1, (int) $request->query('per_page', 25)));
        $page     = max(1, (int) $request->query('page', 1));
        $wantAll  = $request->boolean('all') || $request->get('paginate') === 'false';

        // 60s cache keyed by user (role scope), care type, date range and filters; the 'reports'
        // version is bumped whenever appointments or consultations change.
        $cacheKey = CacheVersion::key('reports', 'appointments', (string) $user->id, $roleType ?? 'all', md5(json_encode([
            $dateFrom, $dateTo,
            $request->query('status'), $request->query('service_id'), $request->query('staff_id'),
            $wantAll ? 'all' : "{$page}:{$perPage}",
        ])));

        $payload = Cache::remember($cacheKey, 60, function () use ($request, $user, $roleType, $dateFrom, $dateTo, $perPage, $page, $wantAll) {
        $query = Appointment::with(Appointment::safeRelations(array_values(array_filter([
            $roleType !== 'dental' ? 'clinicRecord' : null,
            $roleType !== 'medical' ? 'dentalConsultation' : null,
        ]))));

        if ($roleType) {
            $query->where('appointment_type', $roleType);
        }

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

        if ($wantAll) {
            $appointments = $query->orderBy('scheduled_at', 'desc')->orderBy('id', 'desc')->limit(self::ROW_CAP)->get();
            $pagination = ['current_page' => 1, 'last_page' => 1, 'per_page' => $appointments->count(), 'total' => $appointments->count()];
        } else {
            $paginated = $query->orderBy('scheduled_at', 'desc')->orderBy('id', 'desc')->paginate($perPage, ['*'], 'page', $page);
            $appointments = $paginated->getCollection();
            $pagination = [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ];
        }

        // All status counts in ONE aggregate query (was six COUNTs).
        $now = Carbon::now();
        $s = (clone $statsQuery)->selectRaw(
            "COUNT(*) AS total,
             COALESCE(SUM(status = 'completed'), 0) AS completed,
             COALESCE(SUM(status = 'cancelled'), 0) AS cancelled,
             COALESCE(SUM(status = 'confirmed'), 0) AS confirmed,
             COALESCE(SUM(status = 'pending'), 0) AS pending,
             COALESCE(SUM(status = 'no_show'), 0) AS no_show,
             COALESCE(SUM(status = 'confirmed' AND scheduled_at >= ?), 0) AS confirmed_upcoming",
            [$now]
        )->first();

        $total     = (int) $s->total;
        $completed = (int) $s->completed;
        $cancelled = (int) $s->cancelled;
        $confirmed = (int) $s->confirmed;
        $pending   = (int) $s->pending;
        $noShow    = (int) $s->no_show;
        $confirmedUpcoming = (int) $s->confirmed_upcoming;

        $completedPct = $total > 0 ? round(($completed / $total) * 100, 1) : 0;
        $cancelledPct = $total > 0 ? round(($cancelled / $total) * 100, 1) : 0;

        // Service popularity — same filters as the records table so chart and table always agree.
        // ONE grouped join instead of a withCount per service.
        $byService = ClinicService::query()
            ->leftJoin('appointments as a', function ($join) use ($dateFrom, $dateTo, $roleType, $request) {
                $join->on('a.service_id', '=', 'clinic_services.id')
                     ->whereDate('a.scheduled_at', '>=', $dateFrom)
                     ->whereDate('a.scheduled_at', '<=', $dateTo);
                if ($roleType) {
                    $join->where('a.appointment_type', $roleType);
                }
                if ($request->has('status') && $request->status !== 'all') {
                    $join->where('a.status', $request->status);
                }
                if ($request->has('staff_id') && $request->staff_id !== 'all') {
                    $join->where('a.staff_id', $request->staff_id);
                }
            })
            ->where(function ($q) use ($roleType) {
                if ($roleType === 'dental') {
                    $q->where(function ($d) {
                        $d->where('clinic_services.name', 'like', '%dental%')
                          ->orWhere('clinic_services.name', 'like', '%tooth%')
                          ->orWhere('clinic_services.name', 'like', '%teeth%')
                          ->orWhere('clinic_services.name', 'like', '%oral%')
                          ->orWhere('clinic_services.name', 'like', '%extraction%')
                          ->orWhere('clinic_services.name', 'like', '%filling%')
                          ->orWhere('clinic_services.name', 'like', '%cleaning%');
                    });
                } elseif ($roleType === 'medical') {
                    $q->whereNotIn('clinic_services.name', function ($sub) {
                        $sub->select('name')->from('clinic_services')
                            ->where('name', 'like', '%dental%')
                            ->orWhere('name', 'like', '%tooth%')
                            ->orWhere('name', 'like', '%extraction%');
                    });
                }
            })
            ->groupBy('clinic_services.id', 'clinic_services.name')
            ->orderByDesc(DB::raw('COUNT(a.id)'))
            ->orderBy('clinic_services.id')
            ->get(['clinic_services.id', 'clinic_services.name', DB::raw('COUNT(a.id) AS cnt')])
            ->map(fn ($s) => ['name' => $s->name, 'count' => (int) $s->cnt])
            ->values();

        // Group by date — same filters as the records table
        $byDateQuery = Appointment::select(DB::raw('DATE(scheduled_at) as date'), DB::raw('count(*) as count'))
            ->whereDate('scheduled_at', '>=', $dateFrom)
            ->whereDate('scheduled_at', '<=', $dateTo);

        if ($roleType) {
            $byDateQuery->where('appointment_type', $roleType);
        }
        if ($request->has('status') && $request->status !== 'all') {
            $byDateQuery->where('status', $request->status);
        }
        if ($request->has('service_id') && $request->service_id !== 'all') {
            $byDateQuery->where('service_id', $request->service_id);
        }
        if ($request->has('staff_id') && $request->staff_id !== 'all') {
            $byDateQuery->where('staff_id', $request->staff_id);
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

        return [
            'appointments' => $appointments,
            'pagination'   => $pagination,
            'summary'      => [
                'total'              => $total,
                'completed'          => $completed,
                'completed_pct'      => $completedPct,
                'cancelled'          => $cancelled,
                'cancelled_pct'      => $cancelledPct,
                'confirmed'          => $confirmed,
                'confirmed_upcoming' => $confirmedUpcoming,
                'pending'            => $pending,
                'no_show'            => $noShow,
            ],
            'by_service' => $byService,
            'by_date'    => $byDate,
            'filters'    => [
                'services'  => $filterServices,
                'staff'     => $staff,
                'date_from' => $dateFrom,
                'date_to'   => $dateTo,
            ],
        ];
        });

        return response()->json($payload);
    }

    /**
     * Base query for one care type's consultations, already narrowed by the report filters
     * (date range on the effective day, service, staff) and selecting the union columns the
     * paginated "Encounter Logs" list needs. Returns null when the role does not see that type.
     */
    private function consultationBranch(string $care, string $dateFrom, string $dateTo, $serviceId, ?string $svcName, $staffId): ?\Illuminate\Database\Query\Builder
    {
        if ($care === 'medical') {
            $q = DB::table('clinic_records as cr')
                ->whereRaw('COALESCE(cr.visit_date, DATE(cr.created_at)) BETWEEN ? AND ?', [$dateFrom, $dateTo]);
            $this->applyConsultationFilters($q, 'cr', $serviceId, $svcName, $staffId);
            return $q->select([
                'cr.id', 'cr.patient_id',
                DB::raw("'medical' AS care_type"), 'cr.service_name', 'cr.created_by', 'cr.appointment_id',
                DB::raw('COALESCE(cr.visit_date, DATE(cr.created_at)) AS eff_date'), 'cr.created_at',
                DB::raw('0 AS branch'),
            ]);
        }

        if ($care === 'dental') {
            $q = DB::table('dental_consultations as dc')
                ->where(fn ($x) => $x->where('dc.status', 'completed')->orWhereNull('dc.status'))
                ->whereRaw('COALESCE(dc.consultation_date, DATE(dc.created_at)) BETWEEN ? AND ?', [$dateFrom, $dateTo]);
            $this->applyConsultationFilters($q, 'dc', $serviceId, $svcName, $staffId);
            return $q->select([
                'dc.id', 'dc.patient_id',
                DB::raw("'dental' AS care_type"), 'dc.service_name', 'dc.created_by', 'dc.appointment_id',
                DB::raw('COALESCE(dc.consultation_date, DATE(dc.created_at)) AS eff_date'), 'dc.created_at',
                DB::raw('1 AS branch'),
            ]);
        }

        return null;
    }

    /** Service/staff filters shared by every consultation report query (matches the old whereHas logic). */
    private function applyConsultationFilters($query, string $alias, $serviceId, ?string $svcName, $staffId): void
    {
        if ($serviceId && $serviceId !== 'all') {
            $query->where(fn ($q) => $q
                ->whereExists(DB::table('appointments')->selectRaw('1')
                    ->whereColumn('appointments.id', "{$alias}.appointment_id")
                    ->where('appointments.service_id', $serviceId))
                ->orWhere("{$alias}.service_name", $svcName));
        }
        if ($staffId && $staffId !== 'all') {
            $query->where("{$alias}.created_by", $staffId);
        }
    }

    /**
     * The filtered union of medical + dental consultations for the report's care scope.
     *
     * @return array{0: ?\Illuminate\Database\Query\Builder, 1: ?\Illuminate\Database\Query\Builder}
     */
    private function consultationBranches(?string $roleType, string $dateFrom, string $dateTo, $serviceId, ?string $svcName, $staffId): array
    {
        $med  = ($roleType === null || $roleType === 'medical') ? $this->consultationBranch('medical', $dateFrom, $dateTo, $serviceId, $svcName, $staffId) : null;
        $dent = ($roleType === null || $roleType === 'dental')   ? $this->consultationBranch('dental',   $dateFrom, $dateTo, $serviceId, $svcName, $staffId) : null;
        return [$med, $dent];
    }

    /** staff/services filter lists shared by the consultation reports. */
    private function consultationReportFilters(?string $roleType)
    {
        $staffQuery = User::orderBy('name');
        if ($roleType === 'dental') {
            $staffQuery->where('role', 'dentist');
        } elseif ($roleType === 'medical') {
            $staffQuery->where('role', 'clinic_staff');
        } else {
            $staffQuery->whereIn('role', ['clinic_staff', 'dentist']);
        }
        return [
            'staff'     => $staffQuery->get(['id', 'name']),
            'services'  => ClinicService::orderBy('name')->get(['id', 'name']),
        ];
    }

    /**
     * GET /api/reports/consultations
     */
    public function consultationSummary(Request $request): JsonResponse
    {
        // Validate date parameters (fix #3)
        $request->validate([
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to'   => ['nullable', 'date_format:Y-m-d'],
        ]);

        $user = $request->user();
        if (! Roles::isClinicStaff($user)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        // nurse: medical only, dentist: dental only, admin: both (or the one asked for with ?type=)
        $roleType = $this->careTypeFor($user, $request->query('type'));

        $dateFrom = $request->query('date_from', Carbon::now()->startOfMonth()->toDateString());
        $dateTo   = $request->query('date_to', Carbon::now()->endOfMonth()->toDateString());
        $serviceId = $request->query('service_id');
        $staffId   = $request->query('staff_id');
        $perPage  = min(100, max(1, (int) $request->query('per_page', 25)));
        $page     = max(1, (int) $request->query('page', 1));
        $wantAll  = $request->boolean('all') || $request->get('paginate') === 'false';

        $cacheKey = CacheVersion::key('reports', 'consultations', (string) $user->id, $roleType ?? 'all', md5(json_encode([
            $dateFrom, $dateTo, $serviceId, $staffId, $wantAll ? 'all' : "{$page}:{$perPage}",
        ])));

        $payload = Cache::remember($cacheKey, 60, function () use ($roleType, $dateFrom, $dateTo, $serviceId, $staffId, $perPage, $page, $wantAll) {
            $svcName = ($serviceId && $serviceId !== 'all') ? (string) ClinicService::whereKey($serviceId)->value('name') : null;
            [$medQ, $dentQ] = $this->consultationBranches($roleType, $dateFrom, $dateTo, $serviceId, $svcName, $staffId);

            // One UNION of both care types; the outer query orders + paginates the merged list.
            $union = null;
            foreach (array_filter([$medQ, $dentQ]) as $b) {
                $union = $union ? $union->unionAll($b) : $b;
            }
            $outer = $union ? DB::query()->fromSub($union, 'u') : DB::query()->from('clinic_records')->whereRaw('1 = 0');

            $total = (clone $outer)->count();
            $ordered = (clone $outer)
                ->orderByDesc('eff_date')->orderByDesc('created_at')->orderBy('branch')->orderByDesc('id');
            $pageRows = $wantAll ? $ordered->limit(self::ROW_CAP)->get() : $ordered->forPage($page, $perPage)->get();

            // Hydrate only this page's rows (patient, service, staff) — was every row in range.
            $medIds  = $pageRows->where('branch', 0)->pluck('id')->all();
            $dentIds = $pageRows->where('branch', 1)->pluck('id')->all();
            $medModels  = $medIds  ? ClinicRecord::with(['patient.user', 'appointment.service', 'createdBy:' . Appointment::staffColumns()])->whereIn('id', $medIds)->get()->keyBy('id') : collect();
            $dentModels = $dentIds ? DentalConsultation::with(['patient.user', 'appointment.service', 'dentist:' . Appointment::staffColumns()])->whereIn('id', $dentIds)->get()->keyBy('id') : collect();

            $consultations = $pageRows->map(function ($r) use ($medModels, $dentModels) {
                return $r->branch === 0
                    ? ConsultationRow::medical($medModels->get($r->id))
                    : ConsultationRow::dental($dentModels->get($r->id));
            })->values();

            // Aggregates straight from the union — no rows loaded into PHP.
            $byDate = (clone $outer)
                ->selectRaw('eff_date AS d, COUNT(*) AS c')->groupBy('eff_date')->orderBy('d')
                ->pluck('c', 'd')->map(fn ($c) => (int) $c)
                ->mapWithKeys(fn ($c, $d) => [$d => ['date' => $d, 'count' => $c]])->values();

            $byService = (clone $outer)
                ->selectRaw("COALESCE(NULLIF(TRIM(service_name), ''), 'Not specified') AS s, COUNT(*) AS c, MAX(eff_date) AS mx, MAX(created_at) AS mxc")
                ->groupBy('s')->get()
                ->sort(fn ($a, $b) => ($b->c <=> $a->c) ?: strcmp((string) $b->mx, (string) $a->mx) ?: strcmp((string) $b->mxc, (string) $a->mxc))
                ->map(fn ($r) => ['name' => $r->s, 'count' => (int) $r->c])->values();

            $medCount = $medQ ? (clone $medQ)->count() : 0;
            $dentCount = $dentQ ? (clone $dentQ)->count() : 0;

            // Role split needs the patient user — one grouped join per care type.
            $roleCounts = ['student' => 0, 'faculty_staff' => 0];
            foreach ([['clinic_records as cr', 'visit_date'], ['dental_consultations as dc', 'consultation_date']] as [$table, $dateCol]) {
                $care = str_starts_with($table, 'clinic') ? 'medical' : 'dental';
                if (($care === 'medical' && ! $medQ) || ($care === 'dental' && ! $dentQ)) {
                    continue;
                }
                $alias = explode(' as ', $table)[1];
                $q = DB::table($table)
                    ->join('patients as p', 'p.id', '=', "{$alias}.patient_id")
                    ->leftJoin('users as u', 'u.id', '=', 'p.user_id')
                    ->whereRaw("COALESCE({$alias}.{$dateCol}, DATE({$alias}.created_at)) BETWEEN ? AND ?", [$dateFrom, $dateTo]);
                if ($care === 'dental') {
                    $q->where(fn ($x) => $x->where("{$alias}.status", 'completed')->orWhereNull("{$alias}.status"));
                }
                $this->applyConsultationFilters($q, $alias, $serviceId, $svcName, $staffId);
                foreach ($q->selectRaw("COALESCE(u.role, 'student') AS role, COUNT(*) AS c")->groupBy('role')->pluck('c', 'role') as $role => $c) {
                    if (isset($roleCounts[$role])) {
                        $roleCounts[$role] += (int) $c;
                    }
                }
            }

            $filters = $this->consultationReportFilters($roleType);

            return [
                'consultations' => $consultations,
                'pagination'    => $wantAll
                    ? ['current_page' => 1, 'last_page' => 1, 'per_page' => $consultations->count(), 'total' => $total]
                    : ['current_page' => $page, 'last_page' => max(1, (int) ceil($total / $perPage)), 'per_page' => $perPage, 'total' => $total],
                'summary'       => [
                    'total'         => $total,
                    'medical_count' => $medCount,
                    'dental_count'  => $dentCount,
                    'student_count' => $roleCounts['student'],
                    'staff_count'   => $roleCounts['faculty_staff'],
                ],
                'by_date'       => $byDate,
                'by_service'    => $byService,
                'filters'       => [
                    'services'  => $filters['services'],
                    'staff'     => $filters['staff'],
                    'date_from' => $dateFrom,
                    'date_to'   => $dateTo,
                ],
            ];
        });

        return response()->json($payload);
    }

    /**
     * GET /api/reports/inventory
     */
    public function inventorySummary(Request $request): JsonResponse
    {
        // Validate date parameters (fix #3)
        $request->validate([
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to'   => ['nullable', 'date_format:Y-m-d'],
        ]);

        $user = $request->user();
        if (! Roles::isClinicStaff($user)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $dateFrom = $request->query('date_from', Carbon::now()->startOfMonth()->toDateString());
        $dateTo   = $request->query('date_to', Carbon::now()->endOfMonth()->toDateString());
        $perPage  = min(100, max(1, (int) $request->query('per_page', 25)));
        $page     = max(1, (int) $request->query('page', 1));
        $wantAll  = $request->boolean('all') || $request->get('paginate') === 'false';

        $cacheKey = CacheVersion::key('reports', 'inventory', (string) $user->id, md5(json_encode([
            $dateFrom, $dateTo, $wantAll ? 'all' : "{$page}:{$perPage}",
        ])));

        $payload = Cache::remember($cacheKey, 60, function () use ($user, $dateFrom, $dateTo, $perPage, $page, $wantAll) {
        $today    = Carbon::today()->toDateString();
        $in30Days = Carbon::today()->addDays(30)->toDateString();

        $items = InventoryItem::orderBy('name')->get();
        $stockByItem = $this->stockByItem();   // one grouped query for every item (was two SUMs per item)
        $itemList = [];
        $lowStockItems = [];
        $categoryCounts = [];
        $categoryStock = [];

        $totalStock = 0;
        $lowStockCount = 0;
        $outOfStockCount = 0;

        foreach ($items as $item) {
            $isEquipment = $item->category === 'Equipment';
            $stock = $isEquipment ? null : ($stockByItem[$item->id] ?? 0);

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

        // Usage / Transactions in the date range — paginated rows, sums and the daily
        // breakdown come from SQL aggregates (was the whole range loaded into PHP).
        $txQuery = InventoryTransaction::with(['item', 'batch', 'recordedBy', 'patientUser'])
            ->whereBetween('transaction_date', [$dateFrom, $dateTo]);

        // Stock in and manual stock out are shared. Dispensing for a consultation (which names the
        // patient) is shown only for the user's own kind of care: nurse medical, dentist dental, admin both.
        Roles::limitToCare($txQuery, $user, 'consultation_type', includeNull: true);

        $txBase = clone $txQuery;
        $txSums = (clone $txBase)->selectRaw(
            "COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END), 0) AS dispensed,
             COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END), 0) AS received"
        )->first();
        $totalDispensed = (int) $txSums->dispensed;
        $totalReceived  = (int) $txSums->received;

        $usageByDate = (clone $txBase)
            ->selectRaw("COALESCE(transaction_date, DATE(created_at)) AS d,
                COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END), 0) AS dispensed,
                COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END), 0) AS received")
            ->groupBy('d')->orderBy('d')->get()
            ->map(fn ($r) => ['date' => $r->d, 'dispensed' => (int) $r->dispensed, 'received' => (int) $r->received])
            ->values();

        if ($wantAll) {
            $txRows = $txQuery->orderByDesc('created_at')->orderBy('id')->limit(self::ROW_CAP)->get();
            $txPagination = ['current_page' => 1, 'last_page' => 1, 'per_page' => $txRows->count(), 'total' => $txRows->count()];
        } else {
            $txPaginated = $txQuery->orderByDesc('created_at')->orderBy('id')->paginate($perPage, ['*'], 'page', $page);
            $txRows = $txPaginated->getCollection();
            $txPagination = [
                'current_page' => $txPaginated->currentPage(),
                'last_page'    => $txPaginated->lastPage(),
                'per_page'     => $txPaginated->perPage(),
                'total'        => $txPaginated->total(),
            ];
        }

        $transactions = $txRows->map(function ($t) {
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

        // Chart data by category
        $byCategory = [];
        foreach ($categoryCounts as $name => $count) {
            $byCategory[] = [
                'name'  => $name,
                'items' => $count,
                'stock' => $categoryStock[$name] ?? 0,
            ];
        }

        return [
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
            'pagination'        => $txPagination,
            'usage_by_date'     => $usageByDate,
            'by_category'       => $byCategory,
            'filters'           => [
                'date_from' => $dateFrom,
                'date_to'   => $dateTo,
            ],
        ];
        });

        return response()->json($payload);
    }

    /**
     * Prefetched complaint categories for one request: by id and by lowercased name.
     * ComplaintCategoryResolver::nameFor does two lookups PER ROW; reports resolve hundreds
     * of rows, so the maps are loaded once and a local copy of the same rules is applied.
     */
    private function complaintCategoryMaps(): array
    {
        $all = ComplaintCategory::all(['id', 'name']);
        return [
            'byId'  => $all->keyBy('id'),
            'byKey' => $all->mapWithKeys(fn ($c) => [mb_strtolower($c->name) => $c->name]),
        ];
    }

    /** Same result as ComplaintCategoryResolver::nameFor, but against prefetched maps. */
    private function resolvedCategoryName($id, ?string $name, array $maps): ?string
    {
        if ($id && ($c = $maps['byId']->get($id))) {
            return $c->name;
        }

        $name = is_string($name) ? trim($name) : null;
        if ($name === null || $name === '') {
            return null;
        }

        $key = mb_strtolower($name);
        if ($key === 'other') {
            $key = 'others';
        }
        if ($maps['byKey']->has($key)) {
            return $maps['byKey']->get($key);
        }
        if ($key === 'other') {
            return 'Others';
        }

        return $name;
    }

    /**
     * GET /api/reports/frequent-symptoms
     */
    public function symptomsSummary(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! Roles::isClinicStaff($user)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        // nurse: medical only, dentist: dental only, admin: both (or the one asked for with ?type=)
        $roleType = $this->careTypeFor($user, $request->query('type'));

        $dateFrom = $request->query('date_from', Carbon::now()->startOfMonth()->toDateString());
        $dateTo   = $request->query('date_to', Carbon::now()->endOfMonth()->toDateString());
        $serviceId = $request->query('service_id');
        $staffId   = $request->query('staff_id');
        $perPage  = min(100, max(1, (int) $request->query('per_page', 25)));
        $page     = max(1, (int) $request->query('page', 1));
        $wantAll  = $request->boolean('all') || $request->get('paginate') === 'false';

        $cacheKey = CacheVersion::key('reports', 'symptoms', (string) $user->id, $roleType ?? 'all', md5(json_encode([
            $dateFrom, $dateTo, $serviceId, $staffId, $wantAll ? 'all' : "{$page}:{$perPage}",
        ])));

        $payload = Cache::remember($cacheKey, 60, function () use ($roleType, $dateFrom, $dateTo, $serviceId, $staffId, $perPage, $page, $wantAll) {
            $svcName = ($serviceId && $serviceId !== 'all') ? (string) ClinicService::whereKey($serviceId)->value('name') : null;
            [$medQ, $dentQ] = $this->consultationBranches($roleType, $dateFrom, $dateTo, $serviceId, $svcName, $staffId);
            $maps = $this->complaintCategoryMaps();

            $union = null;
            foreach (array_filter([$medQ, $dentQ]) as $b) {
                $union = $union ? $union->unionAll($b) : $b;
            }
            $outer = $union ? DB::query()->fromSub($union, 'u') : DB::query()->from('clinic_records')->whereRaw('1 = 0');

            $totalSymptomsCount = (clone $outer)->count();

            // ── Category counts: a row's category is a pure function of its four complaint
            // fields, so group by them (count + first-seen id) instead of loading every row.
            // Iterating medical groups then dental groups, each newest-first, reproduces the
            // old per-record insertion order that arsort() relies on for ties. ──
            $categoryCounts = [];
            $bump = function (string $cat, int $n) use (&$categoryCounts) {
                $categoryCounts[$cat] = ($categoryCounts[$cat] ?? 0) + $n;
            };

            foreach ([['clinic_records', 'cr', 'visit_date', 'medical', 'chief_complaint'], ['dental_consultations', 'dc', 'consultation_date', 'dental', 'reason_for_visit']] as [$table, $alias, $dateCol, $care, $complaintCol]) {
                $enabled = $care === 'medical' ? $medQ : $dentQ;
                if (! $enabled) {
                    continue;
                }

                $groupsQ = DB::table("{$table} as {$alias}")
                    ->whereRaw("COALESCE({$alias}.{$dateCol}, DATE({$alias}.created_at)) BETWEEN ? AND ?", [$dateFrom, $dateTo])
                    ->when($care === 'dental', fn ($q) => $q->where(fn ($x) => $x->where("{$alias}.status", 'completed')->orWhereNull("{$alias}.status")));
                $this->applyConsultationFilters($groupsQ, $alias, $serviceId, $svcName, $staffId);
                $groups = $groupsQ
                    ->select(
                        "{$alias}.complaint_category_id AS cid",
                        "{$alias}.complaint_category AS cname",
                        "{$alias}.{$complaintCol} AS complaint_text",
                        "{$alias}.diagnosis",
                        DB::raw('COUNT(*) AS c'),
                        DB::raw("MAX({$alias}.id) AS first_id")
                    )
                    ->groupBy("{$alias}.complaint_category_id", "{$alias}.complaint_category", "{$alias}.{$complaintCol}", "{$alias}.diagnosis")
                    ->orderByDesc('first_id')
                    ->get();

                foreach ($groups as $g) {
                    // complaint_text/diagnosis may be ciphertext (encrypted casts) — decrypt for categorizing.
                    $cat = $this->resolvedCategoryName($g->cid, $g->cname, $maps)
                        ?? $this->categorizeComplaint(null, EncryptedFields::decrypt($g->complaint_text), EncryptedFields::decrypt($g->diagnosis), $care);
                    $bump($cat, (int) $g->c);
                }
            }

            arsort($categoryCounts);

            // All categories with percentages
            $allCategories = [];
            foreach ($categoryCounts as $catName => $count) {
                $pct = $totalSymptomsCount > 0 ? round(($count / $totalSymptomsCount) * 100, 1) : 0;
                $allCategories[] = ['name' => $catName, 'count' => $count, 'percentage' => $pct];
            }

            // Top 5 categories + Others (for pie chart, identical to Dashboard)
            $chartCategories = [];
            $othersCount = 0;
            $idx = 0;
            foreach ($categoryCounts as $catName => $count) {
                if ($idx < 5) {
                    $pct = $totalSymptomsCount > 0 ? round(($count / $totalSymptomsCount) * 100, 1) : 0;
                    $chartCategories[] = ['name' => $catName, 'count' => $count, 'percentage' => $pct];
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

            // ── Encounter Logs: paginated union page, hydrated then shaped like before ──
            // Order matches the old usort(raw_date desc) over [medical id-desc][dental id-desc].
            $ordered = (clone $outer)->orderByDesc('eff_date')->orderBy('branch')->orderByDesc('id');
            $pageRows = $wantAll ? $ordered->limit(self::ROW_CAP)->get() : $ordered->forPage($page, $perPage)->get();

            $medIds  = $pageRows->where('branch', 0)->pluck('id')->all();
            $dentIds = $pageRows->where('branch', 1)->pluck('id')->all();
            $medModels  = $medIds  ? ClinicRecord::with(['patient.user', 'appointment.service', 'createdBy'])->whereIn('id', $medIds)->get()->keyBy('id') : collect();
            $dentModels = $dentIds ? DentalConsultation::with(['patient.user', 'appointment.service', 'dentist'])->whereIn('id', $dentIds)->get()->keyBy('id') : collect();

            $consultationLogs = $pageRows->map(function ($r) use ($medModels, $dentModels, $maps) {
                if ($r->branch === 0) {
                    $rec = $medModels->get($r->id);
                    if (! $rec) return null;
                    $cat = $this->resolvedCategoryName($rec->complaint_category_id ?? null, $rec->complaint_category, $maps)
                        ?? $this->categorizeComplaint(null, $rec->chief_complaint, $rec->diagnosis, 'medical');
                    $u = $rec->patient?->user;
                    $vDate = ConsultationRow::day($rec);
                    return [
                        'id'               => "med-{$rec->id}",
                        'type'             => 'medical',
                        'category'         => $cat,
                        'patient_name'     => $u?->name ?? 'Walk-in Patient',
                        'student_id'       => $u?->student_id ?? ($u?->employee_id ?? Placeholder::EMPTY),
                        'role'             => $u?->role ?? 'student',
                        'service'          => ConsultationRow::serviceName($rec),
                        'chief_complaint'  => $rec->chief_complaint ?: Placeholder::EMPTY,
                        'diagnosis'        => $rec->diagnosis ?: Placeholder::EMPTY,
                        'attending_staff'  => $rec->createdBy?->name ?? 'Clinic Nurse',
                        'date'             => ConsultationRow::displayDate($vDate),
                        'raw_date'         => $vDate,
                    ];
                }

                $rec = $dentModels->get($r->id);
                if (! $rec) return null;
                $cat = $this->resolvedCategoryName($rec->complaint_category_id ?? null, $rec->complaint_category, $maps)
                    ?? $this->categorizeComplaint(null, $rec->reason_for_visit, $rec->diagnosis, 'dental');
                $u = $rec->patient?->user;
                $vDate = ConsultationRow::day($rec);
                return [
                    'id'               => "dent-{$rec->id}",
                    'type'             => 'dental',
                    'category'         => $cat,
                    'patient_name'     => $u?->name ?? 'Dental Patient',
                    'student_id'       => $u?->student_id ?? ($u?->employee_id ?? Placeholder::EMPTY),
                    'role'             => $u?->role ?? 'student',
                    'service'          => ConsultationRow::serviceName($rec),
                    'chief_complaint'  => $rec->reason_for_visit ?: Placeholder::EMPTY,
                    'diagnosis'        => $rec->diagnosis ?: Placeholder::EMPTY,
                    'attending_staff'  => $rec->dentist?->name ?? 'Dentist',
                    'date'             => $vDate ? Carbon::parse($vDate)->format('M j, Y') : Placeholder::EMPTY,
                    'raw_date'         => $vDate,
                ];
            })->filter()->values();

            $filters = $this->consultationReportFilters($roleType);

            return [
                'categories'      => $chartCategories,
                'all_categories'  => $allCategories,
                'total_logs'      => $totalSymptomsCount,
                'consultations'   => $consultationLogs,
                'pagination'      => $wantAll
                    ? ['current_page' => 1, 'last_page' => 1, 'per_page' => $consultationLogs->count(), 'total' => $totalSymptomsCount]
                    : ['current_page' => $page, 'last_page' => max(1, (int) ceil($totalSymptomsCount / $perPage)), 'per_page' => $perPage, 'total' => $totalSymptomsCount],
                'filters'         => [
                    'services'  => $filters['services'],
                    'staff'     => $filters['staff'],
                    'date_from' => $dateFrom,
                    'date_to'   => $dateTo,
                ],
            ];
        });

        return response()->json($payload);
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
        $user = $request->user();
        if (! Roles::isClinicStaff($user)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $roleType = $request->query('role_type', 'all');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $perPage  = min(100, max(1, (int) $request->query('per_page', 25)));
        $page     = max(1, (int) $request->query('page', 1));
        $wantAll  = $request->boolean('all') || $request->get('paginate') === 'false';

        $cacheKey = CacheVersion::key('reports', 'chat', (string) $user->id, $roleType, $dateFrom, $dateTo, $wantAll ? 'all' : "{$page}:{$perPage}");

        $payload = Cache::remember($cacheKey, 60, function () use ($user, $roleType, $dateFrom, $dateTo, $perPage, $page, $wantAll) {
        $query = Conversation::query();

        // Conversations are stored per team: 'nurse' (medical) or 'dentist' (dental). The nurse only
        // gets the nurse chats and the dentist only the dentist chats, whatever role_type asks for.
        $teams = array_map(
            fn ($care) => $care === Roles::MEDICAL ? 'nurse' : 'dentist',
            Roles::careTypes($user)
        );
        if (count($teams) === 1) {
            $query->where('staff_role', $teams[0]);
        } elseif ($roleType === 'medical' || $roleType === 'nurse') {
            $query->where('staff_role', 'nurse');
        } elseif ($roleType === 'dental' || $roleType === 'dentist') {
            $query->where('staff_role', 'dentist');
        }

        if ($dateFrom) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }
        if ($dateTo) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        // Counts and the average first-reply time come from ONE aggregate query (the first staff message of
        // each conversation is joined in), instead of loading every conversation with all its messages.
        $firstStaffReply = DB::table('messages as m')
            ->join('users as u', 'u.id', '=', 'm.sender_id')
            ->whereIn('u.role', ['clinic_staff', 'dentist'])
            ->whereNull('m.deleted_at')
            ->groupBy('m.conversation_id')
            ->selectRaw('m.conversation_id, MIN(m.created_at) AS first_staff_at');

        $stats = (clone $query)
            ->leftJoinSub($firstStaffReply, 'f', 'f.conversation_id', '=', 'conversations.id')
            ->selectRaw("COUNT(*) AS total,
                COALESCE(SUM(conversations.status = 'resolved'), 0) AS resolved,
                COALESCE(SUM(conversations.status = 'open'), 0) AS open_count,
                AVG(CASE WHEN f.first_staff_at IS NOT NULL THEN GREATEST(0, TIMESTAMPDIFF(SECOND, conversations.created_at, f.first_staff_at) / 60) END) AS avg_minutes,
                COALESCE(SUM(f.first_staff_at IS NULL AND conversations.status = 'open' AND conversations.created_at <= ?), 0) AS unanswered",
                [Carbon::now()->subHours(24)->toDateTimeString()])
            ->first();

        $total = (int) $stats->total;
        $resolved = (int) $stats->resolved;
        $open = (int) $stats->open_count;
        $unanswered24h = (int) $stats->unanswered;
        $avgResponseMinutes = $stats->avg_minutes !== null ? round((float) $stats->avg_minutes, 1) : 0;

        if ($wantAll) {
            $convRows = $query->with('student')->orderByDesc('id')->limit(self::ROW_CAP)->get();
            $convPagination = ['current_page' => 1, 'last_page' => 1, 'per_page' => $convRows->count(), 'total' => $convRows->count()];
        } else {
            $convPaginated = $query->with('student')->orderByDesc('id')->paginate($perPage, ['*'], 'page', $page);
            $convRows = $convPaginated->getCollection();
            $convPagination = [
                'current_page' => $convPaginated->currentPage(),
                'last_page'    => $convPaginated->lastPage(),
                'per_page'     => $convPaginated->perPage(),
                'total'        => $convPaginated->total(),
            ];
        }
        $conversations = $convRows;

        return [
            'total_conversations'       => $total,
            'resolved_conversations'    => $resolved,
            'open_conversations'        => $open,
            'avg_response_time_minutes' => $avgResponseMinutes,
            'unanswered_24h'            => $unanswered24h,
            'pagination'                => $convPagination,
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
            })->values(),
        ];
        });

        return response()->json($payload);
    }
}
