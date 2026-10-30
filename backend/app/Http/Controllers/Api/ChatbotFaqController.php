<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatbotFaq;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatbotFaqController extends Controller
{
    /** GET /api/chatbot/faqs — list all FAQs (with optional category filter) */
    public function index(Request $request): JsonResponse
    {
        $query = ChatbotFaq::query();

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        // Public view only shows active FAQs; staff/admin see all
        $user = $request->user();
        if ($user && in_array($user->role, ['clinic_staff', 'admin'])) {
            // no active filter — show all for management
        } else {
            $query->where('is_active', true);
        }

        $faqs = $query->orderBy('category')->orderBy('sort_order')->get();

        // Return distinct categories list alongside
        $categories = ChatbotFaq::where('is_active', true)
            ->whereNotNull('category')
            ->distinct()
            ->pluck('category')
            ->sort()
            ->values();

        return response()->json([
            'faqs'       => $faqs,
            'categories' => $categories,
        ]);
    }

    /** GET /api/chatbot/faqs/{faq} — get a single FAQ with full answer */
    public function show(ChatbotFaq $chatbotFaq): JsonResponse
    {
        if (! $chatbotFaq->is_active) {
            return response()->json(['message' => 'FAQ not found.'], 404);
        }
        return response()->json(['faq' => $chatbotFaq]);
    }

    /** POST /api/chatbot/faqs */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'question'   => ['required', 'string'],
            'answer'     => ['required', 'string'],
            'category'   => ['required', 'string', 'max:100'],
            'keywords'   => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active'  => ['nullable', 'boolean'],
        ]);

        $faq = ChatbotFaq::create([
            'question'   => $validated['question'],
            'answer'     => $validated['answer'],
            'category'   => strtolower(trim($validated['category'])),
            'keywords'   => $validated['keywords'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_active'  => $validated['is_active'] ?? true,
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
            'question'   => ['required', 'string'],
            'answer'     => ['required', 'string'],
            'category'   => ['required', 'string', 'max:100'],
            'keywords'   => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active'  => ['nullable', 'boolean'],
        ]);

        $chatbotFaq->update([
            'question'   => $validated['question'],
            'answer'     => $validated['answer'],
            'category'   => strtolower(trim($validated['category'])),
            'keywords'   => $validated['keywords'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_active'  => $validated['is_active'] ?? $chatbotFaq->is_active,
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
}
