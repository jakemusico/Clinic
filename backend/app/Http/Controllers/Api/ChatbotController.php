<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatbotFaq;
use App\Models\ChatbotQuestionLog;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\FaqPlaceholders;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Pure rule-based chatbot — NO AI, NO ML, NO external APIs.
 *
 * Flow:
 *  1. If user sends a menu trigger ("menu", "help", "start", "hi", etc.)
 *     → return top-level category menu (4 categories)
 *  2. If user sends a category name (exact match)
 *     → return subtopics or category FAQs
 *  3. Otherwise run keyword/intent scoring against every active FAQ
 *     → return best-match FAQ or fallback "contact clinic staff" response
 */
class ChatbotController extends Controller
{
    public function __construct(private FaqPlaceholders $placeholders)
    {
    }

    /**
     * Contact-staff fallback response.
     * Contact details come from Admin > Clinic Info, never from typed text.
     */
    private function fallbackResponse(): array
    {
        return [
            'type'    => 'fallback',
            'message' => $this->placeholders->render(
                "I'm sorry, I couldn't find an answer to your question.\n\n"
                . "Please contact the clinic staff directly:\n"
                . "Hotline: {clinic_hotline}\n"
                . "Email: {clinic_email}\n"
                . "Clinic days: {clinic_days}\n"
                . "Hours: {clinic_hours}"
            ),
        ];
    }

    /**
     * POST /api/chatbot/message
     * Body: { message: string }
     */
    public function message(Request $request): JsonResponse
    {
        $request->validate(['message' => ['required', 'string', 'max:500']]);

        $raw  = trim($request->input('message'));
        $text = strtolower($raw);

        /* ── 1. Menu / greeting triggers ──────────────────────────────── */
        $menuTriggers = ['menu', 'help', 'hi', 'hello', 'start', 'helo', 'hey', 'kumusta', 'options'];
        foreach ($menuTriggers as $trigger) {
            if (str_contains($text, $trigger)) {
                return response()->json($this->buildMenuResponse());
            }
        }

        /* ── 2. Category match (user typed the category name directly) ── */
        // Check top-level categories first
        $topCategories = ['health_inquiries', 'clinic_services', 'appointment_help', 'clinic_faqs'];
        foreach ($topCategories as $cat) {
            $catLabel = str_replace('_', ' ', $cat);
            if (str_contains($text, $catLabel) || str_contains($text, str_replace(' ', '', $catLabel))) {
                return response()->json($this->buildCategoryResponse($cat));
            }
        }

        // Check sub-categories
        $categories = ChatbotFaq::where('is_active', true)
            ->whereNotNull('category')
            ->distinct()
            ->pluck('category')
            ->toArray();

        foreach ($categories as $cat) {
            if (str_contains($text, strtolower($cat))) {
                return response()->json($this->buildCategoryResponse($cat));
            }
        }

        /* ── 3. Keyword / intent scoring ──────────────────────────────── */
        $faqs = ChatbotFaq::where('is_active', true)->get();

        $best      = null;
        $bestScore = 0;

        foreach ($faqs as $faq) {
            $score = $faq->matchScore($raw);
            if ($score > $bestScore) {
                $bestScore = $score;
                $best      = $faq;
            }
        }

        // Also do a simple substring search in question text as secondary method
        if (!$best || $bestScore === 0) {
            foreach ($faqs as $faq) {
                if (str_contains(strtolower($faq->question), $text) ||
                    str_contains($text, strtolower(substr($faq->question, 0, 30)))) {
                    $best      = $faq;
                    $bestScore = 1;
                    break;
                }
            }
        }

        if ($best && $bestScore > 0) {
            ChatbotQuestionLog::create([
                'faq_id'   => $best->id,
                'question' => $best->question,
                'category' => $best->category,
                'user_id'  => auth()->id(),
            ]);

            return response()->json([
                'type'     => 'answer',
                'question' => $best->question,
                'answer'   => $this->placeholders->render($best->answer),
                'category' => $best->category,
                'faq_id'   => $best->id,
                'hint'     => 'Type "menu" to see all topics.',
            ]);
        }

        /* ── 4. Fallback ─────────────────────────────────────────────── */
        ChatbotQuestionLog::create([
            'faq_id'   => null,
            'question' => $raw,
            'category' => 'unmatched',
            'user_id'  => auth()->id(),
        ]);

        return response()->json($this->fallbackResponse());
    }

    /**
     * GET /api/chatbot/menu
     * Returns top-level category buttons.
     */
    public function menu(): JsonResponse
    {
        return response()->json($this->buildMenuResponse());
    }

    /**
     * GET /api/chatbot/category/{category}
     * Returns subtopics or FAQs for a given category.
     */
    public function category(string $category): JsonResponse
    {
        return response()->json($this->buildCategoryResponse($category));
    }

    /* ── Private helpers ───────────────────────────────────────────────── */

    private function buildMenuResponse(): array
    {
        $buttons = [
            [
                'label'    => 'Health Inquiries',
                'value'    => 'health_inquiries',
                'category' => 'health_inquiries',
            ],
            [
                'label'    => 'Clinic Services',
                'value'    => 'clinic_services',
                'category' => 'clinic_services',
            ],
            [
                'label'    => 'Appointment Help',
                'value'    => 'appointment_help',
                'category' => 'appointment_help',
            ],
            [
                'label'    => 'Clinic FAQs',
                'value'    => 'clinic_faqs',
                'category' => 'clinic_faqs',
            ],
        ];

        return [
            'type'    => 'menu',
            'message' => "Hi! I'm your FSUU Clinic Assistant.\n\nI can answer questions about our university clinic. Please choose a topic:",
            'buttons' => $buttons,
            'hint'    => 'You can also type your question directly.',
        ];
    }

    private function buildCategoryResponse(string $category): array
    {
        $category = strtolower(trim($category));

        // Define top-level to subtopic mappings
        $subtopics = [
            'health_inquiries' => [
                ['label' => 'Emergency', 'value' => 'emergency'],
                ['label' => 'General Info', 'value' => 'general'],
            ],
            'clinic_services' => [
                ['label' => 'Services', 'value' => 'services'],
                ['label' => 'Dental Services', 'value' => 'dental'],
            ],
            'appointment_help' => [
                ['label' => 'Appointments', 'value' => 'appointments'],
                ['label' => 'Clinic Hours', 'value' => 'hours'],
            ],
            'clinic_faqs' => [
                ['label' => 'Medical Records', 'value' => 'records'],
                ['label' => 'Requirements', 'value' => 'requirements'],
            ],
        ];

        if (array_key_exists($category, $subtopics)) {
            $catLabel = ucwords(str_replace('_', ' ', $category));
            return [
                'type'     => 'subtopics',
                'category' => $category,
                'message'  => "Please choose a specific area under " . $catLabel . ":",
                'buttons'  => $subtopics[$category],
                'hint'     => 'Type "menu" to go back to main topics.',
            ];
        }

        // Subtopic names for header/intro display
        $subtopicNames = [
            'emergency'    => 'Emergency',
            'general'      => 'General Info',
            'services'     => 'Services',
            'dental'       => 'Dental Services',
            'appointments' => 'Appointments',
            'hours'        => 'Clinic Hours',
            'records'      => 'Medical Records',
            'requirements' => 'Requirements',
        ];

        $faqs = ChatbotFaq::where('is_active', true)
            ->where('category', $category)
            ->orderBy('sort_order')
            ->get(['id', 'question', 'category']);

        if ($faqs->isEmpty()) {
            return $this->fallbackResponse();
        }

        $label = $subtopicNames[$category] ?? ucfirst($category);

        return [
            'type'     => 'faq_list',
            'category' => $category,
            'message'  => "Here are questions about **" . $label . "**. Select one to view the answer:",
            'faqs'     => $faqs,
            'hint'     => 'Type "menu" to go back to the main topics.',
        ];
    }

    /**
     * GET /api/chatbot/admin/statistics
     * Admin-only statistics for Chatbot Support.
     * Real live chat data from conversations and messages.
     */
    public function statistics(Request $request): JsonResponse
    {
        $tz     = config('app.timezone', 'Asia/Manila');
        $now    = Carbon::now($tz);
        $period = $request->query('period', 'daily'); // daily | monthly | yearly
        $month  = (int) $request->query('month', $now->month);
        $year   = (int) $request->query('year', $now->year);

        // 1 + 4. Conversation counts, overall and per team: ONE grouped query
        $counts = Conversation::query()
            ->selectRaw('staff_role, status, COUNT(*) AS c')
            ->groupBy('staff_role', 'status')
            ->get();

        $sum = fn (?string $role, ?string $status) => (int) $counts
            ->when($role !== null, fn ($rows) => $rows->where('staff_role', $role))
            ->when($status !== null, fn ($rows) => $rows->where('status', $status))
            ->sum('c');

        $totalConversations    = $sum(null, null);
        $openConversations     = $sum(null, 'open');
        $resolvedConversations = $sum(null, 'resolved');

        // Unanswered = open conversation whose LAST message (soft-deleted ones included) is from the student
        // (or from the conversation's own student), with no staff reply after it.
        $unansweredConversations = (int) (DB::selectOne("
            SELECT COUNT(*) AS n
            FROM conversations c
            JOIN messages m ON m.id = (
                SELECT m2.id FROM messages m2
                WHERE m2.conversation_id = c.id
                ORDER BY m2.created_at DESC, m2.id DESC
                LIMIT 1
            )
            LEFT JOIN users u ON u.id = m.sender_id
            WHERE c.status = 'open'
              AND (u.role = 'student' OR m.sender_id = c.student_id)
        ")->n ?? 0);

        // 2. Average staff response time = average gap between a student message and the first staff reply
        // after it in the same conversation. The first reply of each message is found by a joined subquery.
        $avg = DB::selectOne("
            SELECT ROUND(AVG(ROUND(GREATEST(0, TIMESTAMPDIFF(SECOND, sm.created_at, r.created_at)) / 60, 2)), 1) AS avg_minutes
            FROM messages sm
            JOIN conversations c ON c.id = sm.conversation_id
            LEFT JOIN users su ON su.id = sm.sender_id
            JOIN messages r ON r.id = (
                SELECT m3.id FROM messages m3
                JOIN users u3 ON u3.id = m3.sender_id AND u3.role IN ('clinic_staff', 'nurse', 'dentist')
                WHERE m3.conversation_id = sm.conversation_id
                  AND (m3.created_at > sm.created_at OR (m3.created_at = sm.created_at AND m3.id > sm.id))
                ORDER BY m3.created_at ASC, m3.id ASC
                LIMIT 1
            )
            WHERE (su.role = 'student' OR sm.sender_id = c.student_id)
        ");
        $avgResponseMinutes = $avg && $avg->avg_minutes !== null ? (float) $avg->avg_minutes : null;

        // 3. Conversations over time: distinct conversations that had a message (soft-deleted included) or
        // were created in each day / month / year. One grouped query for the whole range.
        $distinctPerBucket = function (string $bucketSql, Carbon $start, Carbon $end): array {
            $from = $start->toDateTimeString();
            $to   = $end->toDateTimeString();

            $rows = DB::select("
                SELECT {$bucketSql} AS bucket, COUNT(DISTINCT cid) AS n
                FROM (
                    SELECT conversation_id AS cid, created_at AS x FROM messages WHERE created_at BETWEEN ? AND ?
                    UNION ALL
                    SELECT id AS cid, created_at AS x FROM conversations WHERE created_at BETWEEN ? AND ?
                ) t
                GROUP BY bucket
            ", [$from, $to, $from, $to]);

            $out = [];
            foreach ($rows as $row) {
                $out[(int) $row->bucket] = (int) $row->n;
            }

            return $out;
        };

        $chartData = [];

        if ($period === 'daily') {
            $daysInMonth = Carbon::create($year, $month, 1, 0, 0, 0, $tz)->daysInMonth;
            $start = Carbon::create($year, $month, 1, 0, 0, 0, $tz)->startOfDay();
            $end   = Carbon::create($year, $month, $daysInMonth, 23, 59, 59, $tz)->endOfDay();
            $perDay = $distinctPerBucket('DAY(x)', $start, $end);

            for ($day = 1; $day <= $daysInMonth; $day++) {
                $d = Carbon::create($year, $month, $day, 0, 0, 0, $tz);
                $chartData[] = [
                    'label'         => $d->format('M j, Y'),
                    'short_label'   => (string) $day,
                    'conversations' => $perDay[$day] ?? 0,
                ];
            }
        } elseif ($period === 'monthly') {
            $start = Carbon::create($year, 1, 1, 0, 0, 0, $tz)->startOfYear();
            $end   = Carbon::create($year, 12, 31, 23, 59, 59, $tz)->endOfYear();
            $perMonth = $distinctPerBucket('MONTH(x)', $start, $end);

            for ($m = 1; $m <= 12; $m++) {
                $d = Carbon::create($year, $m, 1, 0, 0, 0, $tz);
                $chartData[] = [
                    'label'         => $d->format('F Y'),
                    'short_label'   => $d->format('M'),
                    'conversations' => $perMonth[$m] ?? 0,
                ];
            }
        } else {
            // Yearly - last 5 years
            $startYear = $year - 4;
            $start = Carbon::create($startYear, 1, 1, 0, 0, 0, $tz)->startOfYear();
            $end   = Carbon::create($year, 12, 31, 23, 59, 59, $tz)->endOfYear();
            $perYear = $distinctPerBucket('YEAR(x)', $start, $end);

            for ($y = $startYear; $y <= $year; $y++) {
                $chartData[] = [
                    'label'         => (string) $y,
                    'short_label'   => (string) $y,
                    'conversations' => $perYear[$y] ?? 0,
                ];
            }
        }

        // 5. Top 5 Most Asked FAQs from question log
        $topFaqs = ChatbotQuestionLog::whereNotNull('faq_id')
            ->select('faq_id', DB::raw('count(*) as hits'))
            ->with('faq:id,question,category')
            ->groupBy('faq_id')
            ->orderByDesc('hits')
            ->limit(5)
            ->get()
            ->map(function ($item) {
                return [
                    'faq_id'   => $item->faq_id,
                    'question' => $item->faq?->question ?? ('Question #' . $item->faq_id),
                    'category' => $item->faq?->category ?? 'General',
                    'hits'     => (int) $item->hits,
                ];
            });

        return response()->json([
            'cards' => [
                'total_conversations'      => $totalConversations,
                'open_conversations'       => $openConversations,
                'resolved_conversations'   => $resolvedConversations,
                'unanswered_conversations' => $unansweredConversations,
                'avg_response_time_minutes' => $avgResponseMinutes,
            ],
            'chart_data' => $chartData,
            'by_role' => [
                'nurse' => [
                    'total'    => $sum('nurse', null),
                    'resolved' => $sum('nurse', 'resolved'),
                    'open'     => $sum('nurse', 'open'),
                ],
                'dentist' => [
                    'total'    => $sum('dentist', null),
                    'resolved' => $sum('dentist', 'resolved'),
                    'open'     => $sum('dentist', 'open'),
                ],
            ],
            'top_faqs' => $topFaqs,
        ])->header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
}
