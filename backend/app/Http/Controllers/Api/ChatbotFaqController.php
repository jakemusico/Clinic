<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatbotFaq;
use App\Services\FaqPlaceholders;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ChatbotFaqController extends Controller
{
    public function __construct(private FaqPlaceholders $placeholders)
    {
    }

    /**
     * GET /api/chatbot/faqs — list FAQs (with optional category filter)
     *
     * Answers are returned with {placeholders} already replaced, so the Student,
     * Faculty and Help-page views all see the same text the chatbot sends.
     *
     * Query params:
     *   category — filter by category
     *   help=1   — only FAQs shown on the Help page (active + show_on_help)
     *   raw=1    — staff/admin only: keep the editable template in `answer`, and add
     *              `answer_preview` (replaced text) plus the `placeholders` catalog
     */
    public function index(Request $request): JsonResponse
    {
        $query = ChatbotFaq::query();

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        // Public view only shows active FAQs; staff/admin see all
        $user      = $request->user();
        $canManage = $user && in_array($user->role, ['clinic_staff', 'admin']);

        if (! $canManage) {
            $query->where('is_active', true);
        }

        if ($request->boolean('help')) {
            $query->where('is_active', true)->where('show_on_help', true);
        }

        $raw      = $canManage && $request->boolean('raw');
        $models   = $query->orderBy('category')->orderBy('sort_order')->get();
        $rendered = $this->placeholders->renderMany($models->pluck('answer')->all());

        $faqs = $models->values()->map(function (ChatbotFaq $faq, int $i) use ($raw, $rendered) {
            $data = $faq->toArray();

            if ($raw) {
                $data['answer_preview'] = $rendered[$i];   // `answer` stays the editable template
            } else {
                $data['answer'] = $rendered[$i];
            }

            return $data;
        });

        // Return distinct categories list alongside
        $categories = ChatbotFaq::where('is_active', true)
            ->whereNotNull('category')
            ->distinct()
            ->pluck('category')
            ->sort()
            ->values();

        $payload = [
            'faqs'       => $faqs,
            'categories' => $categories,
        ];

        if ($raw) {
            $payload['placeholders'] = $this->placeholders->catalog();
        }

        return response()->json($payload);
    }

    /** GET /api/chatbot/faqs/{faq} — get a single FAQ with full answer (placeholders replaced) */
    public function show(ChatbotFaq $chatbotFaq): JsonResponse
    {
        if (! $chatbotFaq->is_active) {
            return response()->json(['message' => 'FAQ not found.'], 404);
        }

        $data           = $chatbotFaq->toArray();
        $data['answer'] = $this->placeholders->render($chatbotFaq->answer);

        return response()->json(['faq' => $data]);
    }

    /** POST /api/chatbot/faqs */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'question'     => ['required', 'string'],
            'answer'       => ['required', 'string'],
            'category'     => ['required', 'string', 'max:100'],
            'keywords'     => ['nullable', 'string'],
            'sort_order'   => ['nullable', 'integer', 'min:0'],
            'is_active'    => ['nullable', 'boolean'],
            'show_on_help' => ['nullable', 'boolean'],
        ]);

        $this->rejectUnknownPlaceholders($validated['answer']);

        $faq = ChatbotFaq::create([
            'question'     => $validated['question'],
            'answer'       => $validated['answer'],
            'category'     => strtolower(trim($validated['category'])),
            'keywords'     => $validated['keywords'] ?? null,
            'sort_order'   => $validated['sort_order'] ?? 0,
            'is_active'    => $validated['is_active'] ?? true,
            'show_on_help' => $validated['show_on_help'] ?? true,
        ]);

        return response()->json([
            'message' => 'FAQ created successfully.',
            'faq'     => $faq,
        ], 201);
    }

    /** PUT /api/chatbot/faqs/{faq} */
    public function update(Request $request, ChatbotFaq $chatbotFaq): JsonResponse
    {
        $validated = $request->validate([
            'question'     => ['required', 'string'],
            'answer'       => ['required', 'string'],
            'category'     => ['required', 'string', 'max:100'],
            'keywords'     => ['nullable', 'string'],
            'sort_order'   => ['nullable', 'integer', 'min:0'],
            'is_active'    => ['nullable', 'boolean'],
            'show_on_help' => ['nullable', 'boolean'],
        ]);

        $this->rejectUnknownPlaceholders($validated['answer']);

        $chatbotFaq->update([
            'question'     => $validated['question'],
            'answer'       => $validated['answer'],
            'category'     => strtolower(trim($validated['category'])),
            'keywords'     => $validated['keywords'] ?? null,
            'sort_order'   => $validated['sort_order'] ?? 0,
            'is_active'    => $validated['is_active'] ?? $chatbotFaq->is_active,
            'show_on_help' => $validated['show_on_help'] ?? $chatbotFaq->show_on_help,
        ]);

        return response()->json([
            'message' => 'FAQ updated successfully.',
            'faq'     => $chatbotFaq,
        ]);
    }

    /** DELETE /api/chatbot/faqs/{faq} */
    public function destroy(ChatbotFaq $chatbotFaq): JsonResponse
    {
        $chatbotFaq->delete();
        return response()->json(['message' => 'FAQ deleted successfully.']);
    }

    /** PATCH /api/chatbot/faqs/{faq}/toggle */
    public function toggle(ChatbotFaq $chatbotFaq): JsonResponse
    {
        $chatbotFaq->update(['is_active' => ! $chatbotFaq->is_active]);
        return response()->json([
            'message' => 'FAQ status updated.',
            'faq'     => $chatbotFaq,
        ]);
    }

    /** PATCH /api/chatbot/faqs/{faq}/help — show/hide on the Student & Faculty Help page */
    public function toggleHelp(ChatbotFaq $chatbotFaq): JsonResponse
    {
        $chatbotFaq->update(['show_on_help' => ! $chatbotFaq->show_on_help]);
        return response()->json([
            'message' => 'FAQ Help page visibility updated.',
            'faq'     => $chatbotFaq,
        ]);
    }

    /**
     * A mistyped token such as {clinic_hour} would be shown to students as-is,
     * so refuse to save it and tell the admin which tokens are valid.
     */
    private function rejectUnknownPlaceholders(string $answer): void
    {
        $unknown = $this->placeholders->unknownTokens($answer);

        if ($unknown) {
            throw ValidationException::withMessages([
                'answer' => 'Unknown placeholder ' . implode(', ', $unknown)
                    . '. Available: ' . implode(', ', $this->placeholders->tokens()) . '.',
            ]);
        }
    }
}
