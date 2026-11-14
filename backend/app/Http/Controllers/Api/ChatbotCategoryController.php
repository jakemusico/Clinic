<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatbotCategory;
use App\Models\ChatbotFaq;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatbotCategoryController extends Controller
{
    /**
     * GET /api/chatbot/categories
     * List all categories (admin sees all, students see only active with visible FAQs).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isAdmin = $user && in_array($user->role, ['clinic_staff', 'admin']);

        $query = ChatbotCategory::query()->orderBy('sort_order')->orderBy('name');

        if (!$isAdmin) {
            // Students only see active categories with at least one active FAQ with show_on_help
            $query->where('is_active', true)
                ->whereHas('faqs', function ($q) {
                    $q->where('is_active', true)->where('show_on_help', true);
                });
        }

        $categories = $query->get();

        // Add FAQ count for admin view
        if ($isAdmin) {
            $categories->each(function ($category) {
                $category->faq_count = $category->faqs()->count();
            });
        }

        return response()->json(['categories' => $categories]);
    }

    /**
     * POST /api/chatbot/categories
     * Create a new category (admin only).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'       => ['required', 'string', 'max:100', 'unique:chatbot_categories,name'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active'  => ['nullable', 'boolean'],
        ]);

        $category = ChatbotCategory::create([
            'name'       => strtolower(trim($validated['name'])),
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_active'  => $validated['is_active'] ?? true,
        ]);

        return response()->json([
            'message'  => 'Category created successfully.',
            'category' => $category,
        ], 201);
    }

    /**
     * PUT /api/chatbot/categories/{id}
     * Update a category (admin only).
     */
    public function update(Request $request, ChatbotCategory $chatbotCategory): JsonResponse
    {
        $validated = $request->validate([
            'name'       => ['required', 'string', 'max:100', 'unique:chatbot_categories,name,' . $chatbotCategory->id],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active'  => ['nullable', 'boolean'],
        ]);

        $oldName = $chatbotCategory->name;
        $newName = strtolower(trim($validated['name']));

        $chatbotCategory->update([
            'name'       => $newName,
            'sort_order' => $validated['sort_order'] ?? $chatbotCategory->sort_order,
            'is_active'  => $validated['is_active'] ?? $chatbotCategory->is_active,
        ]);

        // If category name changed, update all FAQs using the old name
        if ($oldName !== $newName) {
            ChatbotFaq::where('category', $oldName)->update(['category' => $newName]);
        }

        return response()->json([
            'message'  => 'Category updated successfully.',
            'category' => $chatbotCategory,
        ]);
    }

    /**
     * DELETE /api/chatbot/categories/{id}
     * Delete a category only if it has no FAQs (admin only).
     */
    public function destroy(ChatbotCategory $chatbotCategory): JsonResponse
    {
        $faqCount = $chatbotCategory->faqs()->count()
            + ChatbotFaq::whereNull('category_id')->where('category', $chatbotCategory->name)->count();

        if ($faqCount > 0) {
            return response()->json([
                'message' => "Cannot delete category with {$faqCount} FAQ(s). Please move or delete the FAQs first, or deactivate the category instead.",
                'faq_count' => $faqCount,
            ], 422);
        }

        $chatbotCategory->delete();

        return response()->json([
            'message' => 'Category deleted successfully.',
        ]);
    }

    /**
     * PATCH /api/chatbot/categories/{id}/toggle
     * Toggle active/inactive status (admin only).
     */
    public function toggle(ChatbotCategory $chatbotCategory): JsonResponse
    {
        $chatbotCategory->update(['is_active' => !$chatbotCategory->is_active]);

        return response()->json([
            'message'  => 'Category status updated.',
            'category' => $chatbotCategory,
        ]);
    }
}
