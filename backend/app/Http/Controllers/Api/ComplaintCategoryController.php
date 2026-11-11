<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ComplaintCategory;
use App\Support\CacheVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ComplaintCategoryController extends Controller
{
    /**
     * GET /api/complaint-categories
     * Admins see every category; everyone else only the active ones, in sort order.
     */
    public function index(Request $request): JsonResponse
    {
        $isAdmin = $request->user()?->role === 'admin';

        $query = ComplaintCategory::query()->orderBy('sort_order')->orderBy('name');

        $type = $request->query('type');
        if (is_string($type) && in_array($type, ['medical', 'dental'], true)) {
            $query->where('type', $type);
        }

        if (! $isAdmin) {
            $query->where('is_active', true);
        }

        return response()->json(['categories' => $query->get()]);
    }

    /**
     * POST /api/admin/complaint-categories
     * Names are unique case-insensitively.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'       => ['required', 'string', 'max:100'],
            'type'       => ['nullable', 'string', 'in:medical,dental'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active'  => ['nullable', 'boolean'],
        ]);

        $type = $validated['type'] ?? 'medical';
        $name = trim($validated['name']);
        if ($this->nameTaken($name, null, $type)) {
            return response()->json(['message' => 'A complaint category with this name already exists.'], 422);
        }

        $category = ComplaintCategory::create([
            'name'       => $name,
            'type'       => $type,
            'sort_order' => $validated['sort_order'] ?? ((int) ComplaintCategory::where('type', $type)->max('sort_order')) + 10,
            'is_active'  => $validated['is_active'] ?? true,
        ]);

        CacheVersion::bump('dashboard');

        return response()->json([
            'message'  => 'Complaint category created.',
            'category' => $category,
        ], 201);
    }

    /**
     * PUT /api/admin/complaint-categories/{complaintCategory}
     * Rename / reorder / toggle in one call.
     */
    public function update(Request $request, ComplaintCategory $complaintCategory): JsonResponse
    {
        $validated = $request->validate([
            'name'       => ['required', 'string', 'max:100'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active'  => ['nullable', 'boolean'],
        ]);

        $name = trim($validated['name']);
        if ($this->nameTaken($name, $complaintCategory->id, $complaintCategory->type)) {
            return response()->json(['message' => 'A complaint category with this name already exists.'], 422);
        }

        $complaintCategory->update([
            'name'       => $name,
            'sort_order' => $validated['sort_order'] ?? $complaintCategory->sort_order,
            'is_active'  => $validated['is_active'] ?? $complaintCategory->is_active,
        ]);

        CacheVersion::bump('dashboard');

        return response()->json([
            'message'  => 'Complaint category updated.',
            'category' => $complaintCategory,
        ]);
    }

    /**
     * PATCH /api/admin/complaint-categories/{complaintCategory}/toggle
     */
    public function toggle(ComplaintCategory $complaintCategory): JsonResponse
    {
        $complaintCategory->update(['is_active' => ! $complaintCategory->is_active]);

        CacheVersion::bump('dashboard');

        return response()->json([
            'message'  => 'Complaint category status updated.',
            'category' => $complaintCategory,
        ]);
    }

    /**
     * POST /api/admin/complaint-categories/reorder
     * Body: { ids: [3, 1, 2, ...] } — sort_order becomes the position in the list.
     */
    public function reorder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids'   => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', Rule::exists('complaint_categories', 'id')],
        ]);

        foreach ($validated['ids'] as $position => $id) {
            ComplaintCategory::whereKey($id)->update(['sort_order' => ($position + 1) * 10]);
        }

        CacheVersion::bump('dashboard');

        return response()->json(['message' => 'Complaint categories reordered.']);
    }

    /** Case-insensitive uniqueness check (the DB collation is already CI, this keeps it explicit). */
    private function nameTaken(string $name, ?int $exceptId = null, ?string $type = null): bool
    {
        $key = mb_strtolower(trim($name));
        if ($key === 'other') {
            $key = 'others';   // "Other" is merged into "Others" — never allow it back
        }

        return ComplaintCategory::whereRaw('LOWER(TRIM(name)) = ?', [$key])
            ->when($type, fn ($q) => $q->where('type', $type))
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->exists();
    }
}
