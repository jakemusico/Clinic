<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatbotFaq;
use App\Models\ChatbotQuestionLog;
use App\Models\Conversation;
use App\Models\Message;
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
    /** Contact-staff fallback response */
    private const FALLBACK = [
        'type'    => 'fallback',
        'message' => "I'm sorry, I couldn't find an answer to your question.\n\nPlease contact the clinic staff directly:\nClinic hotline: (02) 8888-0000\nEmail: clinic@university.edu\nHours: Mon–Fri, 8:00 AM – 5:00 PM",
    ];

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
                'answer'   => $best->answer,
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

        return response()->json(self::FALLBACK);
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
            return self::FALLBACK;
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

        // 1. Overall conversation cards
        $totalConversations    = Conversation::count();
        $openConversations     = Conversation::where('status', 'open')->count();
        $resolvedConversations = Conversation::where('status', 'resolved')->count();

        // Unanswered = open conversation where the latest message is from the student with no staff reply after it
        $unansweredConversations = 0;
        $openConvs = Conversation::where('status', 'open')
            ->with(['messages' => function ($q) {
                $q->withTrashed()->with('sender')->orderBy('created_at', 'asc')->orderBy('id', 'asc');
            }])
            ->get();

        foreach ($openConvs as $conv) {
            $lastMsg = $conv->messages->last();
            if ($lastMsg) {
                $isStudent = ($lastMsg->sender && $lastMsg->sender->role === 'student')
                    || ((int) $lastMsg->sender_id === (int) $conv->student_id);
                if ($isStudent) {
                    $unansweredConversations++;
                }
            }
        }

        // 2. Average Staff Response Time = average gap between a student message and the first staff reply after it
        $responseTimes = [];
        $allConversations = Conversation::with(['messages' => function ($q) {
            $q->withTrashed()->with('sender')->orderBy('created_at', 'asc')->orderBy('id', 'asc');
        }])->get();

        foreach ($allConversations as $conv) {
            $messages = $conv->messages;
            $count = count($messages);
            for ($i = 0; $i < $count; $i++) {
                $m = $messages[$i];
                $isStudent = ($m->sender && $m->sender->role === 'student')
                    || ((int) $m->sender_id === (int) $conv->student_id);

                if ($isStudent) {
                    // Find the first staff reply after this student message
                    for ($j = $i + 1; $j < $count; $j++) {
                        $other = $messages[$j];
                        $isStaff = $other->sender && in_array($other->sender->role, ['clinic_staff', 'nurse', 'dentist']);
                        if ($isStaff) {
                            $mTime = Carbon::parse($m->created_at);
                            $rTime = Carbon::parse($other->created_at);
                            $diffSec = $mTime->diffInSeconds($rTime);
                            $responseTimes[] = max(0, round($diffSec / 60, 2));
                            break;
                        }
                    }
                }
            }
        }

        $avgResponseMinutes = count($responseTimes) > 0
            ? round(array_sum($responseTimes) / count($responseTimes), 1)
            : null;

        // 3. Conversations Over Time Chart Data
        // Count distinct conversations with at least one message per day/month/year (including soft-deleted messages, plus conversations created)
        $chartData = [];

        if ($period === 'daily') {
            $daysInMonth = Carbon::create($year, $month, 1, 0, 0, 0, $tz)->daysInMonth;
            $start = Carbon::create($year, $month, 1, 0, 0, 0, $tz)->startOfDay();
            $end   = Carbon::create($year, $month, $daysInMonth, 23, 59, 59, $tz)->endOfDay();

            $dayConvs = array_fill(1, $daysInMonth, []);

            // Messages within this month
            $monthMessages = Message::withTrashed()
                ->whereBetween('created_at', [$start, $end])
                ->select('conversation_id', 'created_at')
                ->get();

            foreach ($monthMessages as $m) {
                $d = Carbon::parse($m->created_at)->setTimezone($tz);
                if ($d->year === $year && $d->month === $month) {
                    $dayConvs[$d->day][$m->conversation_id] = true;
                }
            }

            // Conversations created within this month
            $monthConvs = Conversation::whereBetween('created_at', [$start, $end])
                ->select('id', 'created_at')
                ->get();

            foreach ($monthConvs as $c) {
                $d = Carbon::parse($c->created_at)->setTimezone($tz);
                if ($d->year === $year && $d->month === $month) {
                    $dayConvs[$d->day][$c->id] = true;
                }
            }

            for ($day = 1; $day <= $daysInMonth; $day++) {
                $d = Carbon::create($year, $month, $day, 0, 0, 0, $tz);
                $chartData[] = [
                    'label'         => $d->format('M j, Y'),
                    'short_label'   => (string) $day,
                    'conversations' => count($dayConvs[$day]),
                ];
            }
        } elseif ($period === 'monthly') {
            $start = Carbon::create($year, 1, 1, 0, 0, 0, $tz)->startOfYear();
            $end   = Carbon::create($year, 12, 31, 23, 59, 59, $tz)->endOfYear();

            $monthConvsMap = array_fill(1, 12, []);

            $yearMessages = Message::withTrashed()
                ->whereBetween('created_at', [$start, $end])
                ->select('conversation_id', 'created_at')
                ->get();

            foreach ($yearMessages as $m) {
                $d = Carbon::parse($m->created_at)->setTimezone($tz);
                if ($d->year === $year) {
                    $monthConvsMap[$d->month][$m->conversation_id] = true;
                }
            }

            $yearConvs = Conversation::whereBetween('created_at', [$start, $end])
                ->select('id', 'created_at')
                ->get();

            foreach ($yearConvs as $c) {
                $d = Carbon::parse($c->created_at)->setTimezone($tz);
                if ($d->year === $year) {
                    $monthConvsMap[$d->month][$c->id] = true;
                }
            }

            for ($m = 1; $m <= 12; $m++) {
                $d = Carbon::create($year, $m, 1, 0, 0, 0, $tz);
                $chartData[] = [
                    'label'         => $d->format('F Y'),
                    'short_label'   => $d->format('M'),
                    'conversations' => count($monthConvsMap[$m]),
                ];
            }
        } else {
            // Yearly - last 5 years
            $startYear = $year - 4;
            $start = Carbon::create($startYear, 1, 1, 0, 0, 0, $tz)->startOfYear();
            $end   = Carbon::create($year, 12, 31, 23, 59, 59, $tz)->endOfYear();

            $yearConvsMap = [];
            for ($y = $startYear; $y <= $year; $y++) {
                $yearConvsMap[$y] = [];
            }

            $rangeMessages = Message::withTrashed()
                ->whereBetween('created_at', [$start, $end])
                ->select('conversation_id', 'created_at')
                ->get();

            foreach ($rangeMessages as $m) {
                $d = Carbon::parse($m->created_at)->setTimezone($tz);
                if (isset($yearConvsMap[$d->year])) {
                    $yearConvsMap[$d->year][$m->conversation_id] = true;
                }
            }

            $rangeConvs = Conversation::whereBetween('created_at', [$start, $end])
                ->select('id', 'created_at')
                ->get();

            foreach ($rangeConvs as $c) {
                $d = Carbon::parse($c->created_at)->setTimezone($tz);
                if (isset($yearConvsMap[$d->year])) {
                    $yearConvsMap[$d->year][$c->id] = true;
                }
            }

            for ($y = $startYear; $y <= $year; $y++) {
                $chartData[] = [
                    'label'         => (string) $y,
                    'short_label'   => (string) $y,
                    'conversations' => count($yearConvsMap[$y]),
                ];
            }
        }

        // 4. By Staff Role
        $nurseTotal    = Conversation::where('staff_role', 'nurse')->count();
        $nurseResolved = Conversation::where('staff_role', 'nurse')->where('status', 'resolved')->count();
        $nurseOpen     = Conversation::where('staff_role', 'nurse')->where('status', 'open')->count();

        $dentistTotal    = Conversation::where('staff_role', 'dentist')->count();
        $dentistResolved = Conversation::where('staff_role', 'dentist')->where('status', 'resolved')->count();
        $dentistOpen     = Conversation::where('staff_role', 'dentist')->where('status', 'open')->count();

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
                    'total'    => $nurseTotal,
                    'resolved' => $nurseResolved,
                    'open'     => $nurseOpen,
                ],
                'dentist' => [
                    'total'    => $dentistTotal,
                    'resolved' => $dentistResolved,
                    'open'     => $dentistOpen,
                ],
            ],
            'top_faqs' => $topFaqs,
        ])->header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
}
