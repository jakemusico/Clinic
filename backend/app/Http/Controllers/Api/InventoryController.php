<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\InsufficientStockException;
use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\InventoryBatch;
use App\Models\InventoryTransaction;
use App\Models\Notification;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    // ── Shared helpers ────────────────────────────────────────────────────


    /**
     * Current stock for EVERY item in one query (IN minus OUT), keyed by item id.
     * Avoids running two SUM queries per item when listing many items.
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
     * Calculate current stock for a non-equipment item.
     */
    private function getStock(int $itemId): int
    {
        $in  = InventoryTransaction::where('item_id', $itemId)->where('type', 'IN')->sum('quantity');
        $out = InventoryTransaction::where('item_id', $itemId)->where('type', 'OUT')->sum('quantity');
        return max(0, $in - $out);
    }

    /**
     * Pre-validate stock availability without writing any transactions.
     * Returns array of error messages (empty = OK).
     */
    public static function preValidateStock(array $items): array
    {
        $errors = [];
        foreach ($items as $row) {
            $item = InventoryItem::find($row['item_id'] ?? null);
            $qty  = (int) ($row['quantity'] ?? 0);
            if (!$item || $qty <= 0) continue;
            $in  = InventoryTransaction::where('item_id', $item->id)->where('type', 'IN')->sum('quantity');
            $out = InventoryTransaction::where('item_id', $item->id)->where('type', 'OUT')->sum('quantity');
            $stock = max(0, $in - $out);
            if ($qty > $stock) {
                $errors[] = "Insufficient stock for \"{$item->name}\" (available: {$stock} {$item->unit}, requested: {$qty}).";
            }
        }
        return $errors;
    }

    /**
     * Append stock info to an item for API responses.
     */
    private function withStock(InventoryItem $item): array
    {
        $data = $item->toArray();
        $today = now()->toDateString();
        $in30Days = now()->addDays(30)->toDateString();

        if ($item->category !== 'Equipment') {
            $stock = $this->getStock($item->id);
            $data['current_stock']   = $stock;
            $data['is_low_stock']    = $stock > 0 && $stock <= $item->reorder_level;
            $data['is_out_of_stock'] = $stock === 0;

            $nearestBatch = $item->batches()
                ->whereNotNull('expiry_date')
                ->where('quantity_in', '>', DB::raw('quantity_used'))
                ->orderBy('expiry_date')
                ->first();

            if ($nearestBatch) {
                $expDate = $nearestBatch->expiry_date->toDateString();
                $data['nearest_expiry'] = $expDate;
                $data['nearest_batch']  = [
                    'id'          => $nearestBatch->id,
                    'batch_no'    => $nearestBatch->batch_no,
                    'expiry_date' => $expDate,
                    'remaining'   => max(0, $nearestBatch->quantity_in - $nearestBatch->quantity_used),
                    'supplier'    => $nearestBatch->supplier,
                ];
                if ($expDate < $today) {
                    $data['expiry_status'] = 'expired';
                } elseif ($expDate <= $in30Days) {
                    $data['expiry_status'] = 'expiring_soon';
                } else {
                    $data['expiry_status'] = 'ok';
                }
            } else {
                $data['nearest_expiry'] = null;
                $data['nearest_batch']  = null;
                $data['expiry_status']  = null;
            }
        } else {
            $data['current_stock']   = null;
            $data['is_low_stock']    = false;
            $data['is_out_of_stock'] = false;
            $data['nearest_expiry']  = null;
            $data['nearest_batch']   = null;
            $data['expiry_status']   = null;
        }

        return $data;
    }

    // ── Dashboard ─────────────────────────────────────────────────────────

    public function dashboard(): JsonResponse
    {
        $items = InventoryItem::all();

        $totalItems  = $items->count();
        $lowStock    = 0;
        $expiringSoon = 0;
        $expired     = 0;

        foreach ($items->where('category', '!=', 'Equipment') as $item) {
            $stock = $this->getStock($item->id);
            if ($stock > 0 && $stock <= $item->reorder_level) {
                $lowStock++;
            }
        }

        $today         = now()->toDateString();
        $in30Days      = now()->addDays(30)->toDateString();

        $batchesWithExpiry = InventoryBatch::with('item')
            ->whereNotNull('expiry_date')
            ->where('quantity_in', '>', DB::raw('quantity_used'))
            ->get();

        foreach ($batchesWithExpiry as $batch) {
            if ($batch->expiry_date->toDateString() <= $today) {
                $expired++;
            } elseif ($batch->expiry_date->toDateString() <= $in30Days) {
                $expiringSoon++;
            }
        }

        // Low stock items list
        $lowStockItems = [];
        foreach ($items->where('category', '!=', 'Equipment') as $item) {
            $stock = $this->getStock($item->id);
            if ($stock <= $item->reorder_level) {
                $lowStockItems[] = [
                    'id'            => $item->id,
                    'name'          => $item->name,
                    'category'      => $item->category,
                    'unit'          => $item->unit,
                    'current_stock' => $stock,
                    'reorder_level' => $item->reorder_level,
                ];
            }
        }

        // Expiring / expired batches
        $expiryBatches = InventoryBatch::with('item')
            ->whereNotNull('expiry_date')
            ->where('quantity_in', '>', DB::raw('quantity_used'))
            ->orderBy('expiry_date')
            ->get()
            ->filter(fn($b) => $b->expiry_date->toDateString() <= $in30Days)
            ->values()
            ->map(fn($b) => [
                'id'          => $b->id,
                'item_id'     => $b->item_id,
                'item_name'   => $b->item->name ?? '',
                'batch_no'    => $b->batch_no,
                'expiry_date' => $b->expiry_date->toDateString(),
                'remaining'   => max(0, $b->quantity_in - $b->quantity_used),
                'is_expired'  => $b->expiry_date->toDateString() <= $today,
            ]);

        // Recent 10 transactions
        $recent = InventoryTransaction::with(['item', 'recordedBy', 'patientUser'])
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        return response()->json([
            'stats' => [
                'total_items'   => $totalItems,
                'low_stock'     => $lowStock,
                'expiring_soon' => $expiringSoon,
                'expired'       => $expired,
            ],
            'low_stock_items'   => $lowStockItems,
            'expiry_batches'    => $expiryBatches,
            'recent_transactions' => $recent,
        ]);
    }

    /**
     * Summary for Admin Dashboard alert (low_stock + expiring_soon count).
     */
    public function alertSummary(): JsonResponse
    {
        $items = InventoryItem::where('category', '!=', 'Equipment')->get();
        $lowStock = 0;
        foreach ($items as $item) {
            $stock = $this->getStock($item->id);
            if ($stock > 0 && $stock <= $item->reorder_level) {
                $lowStock++;
            }
        }

        $today    = now()->toDateString();
        $in30Days = now()->addDays(30)->toDateString();

        $expiringSoon = InventoryBatch::whereNotNull('expiry_date')
            ->where('expiry_date', '>', $today)
            ->where('expiry_date', '<=', $in30Days)
            ->where('quantity_in', '>', DB::raw('quantity_used'))
            ->count();

        return response()->json([
            'low_stock'     => $lowStock,
            'expiring_soon' => $expiringSoon,
        ]);
    }

    // ── Items ─────────────────────────────────────────────────────────────

    public function itemIndex(Request $request): JsonResponse
    {
        $q = InventoryItem::query();

        if ($request->has('search') && $request->search !== '') {
            $search = $request->search;
            $q->where(function ($query) use ($search) {
                $query->where('name', 'like', "%{$search}%")
                      ->orWhere('category', 'like', "%{$search}%")
                      ->orWhere('unit', 'like', "%{$search}%")
                      ->orWhere('location', 'like', "%{$search}%");
            });
        }

        if ($request->has('category') && $request->category !== 'all') {
            if (str_contains($request->category, ',')) {
                $q->whereIn('category', array_map('trim', explode(',', $request->category)));
            } else {
                $q->where('category', $request->category);
            }
        }

        if ($request->has('status') && $request->status !== 'all') {
            if ($request->status === 'active') {
                $q->where('is_active', true);
            } elseif ($request->status === 'inactive') {
                $q->where('is_active', false);
            }
        }

        $items = $q->orderBy('name')->get();
        $result = $items->map(fn($item) => $this->withStock($item));

        if ($request->has('status') && in_array($request->status, ['low_stock', 'expiring_soon', 'out_of_stock'])) {
            if ($request->status === 'low_stock') {
                $result = $result->filter(fn($i) => $i['category'] !== 'Equipment' && $i['is_low_stock'])->values();
            } elseif ($request->status === 'expiring_soon') {
                $result = $result->filter(fn($i) => in_array($i['expiry_status'], ['expiring_soon', 'expired']))->values();
            } elseif ($request->status === 'out_of_stock') {
                $result = $result->filter(fn($i) => $i['category'] !== 'Equipment' && $i['is_out_of_stock'])->values();
            }
        }

        // Summary counts matching Inventory Dashboard
        $allItems = InventoryItem::all();
        $totalItems = $allItems->count();
        $lowStockCount = 0;
        $outOfStockCount = 0;

        foreach ($allItems->where('category', '!=', 'Equipment') as $item) {
            $stock = $this->getStock($item->id);
            if ($stock > 0 && $stock <= $item->reorder_level) {
                $lowStockCount++;
            }
            if ($stock === 0) {
                $outOfStockCount++;
            }
        }

        $today    = now()->toDateString();
        $in30Days = now()->addDays(30)->toDateString();

        $expiringSoonCount = InventoryBatch::whereNotNull('expiry_date')
            ->where('quantity_in', '>', DB::raw('quantity_used'))
            ->where('expiry_date', '>', $today)
            ->where('expiry_date', '<=', $in30Days)
            ->count();

        $summary = [
            'total_items'   => $totalItems,
            'low_stock'     => $lowStockCount,
            'expiring_soon' => $expiringSoonCount,
            'out_of_stock'  => $outOfStockCount,
        ];

        if ($request->boolean('all') || $request->input('paginate') === 'false') {
            return response()->json([
                'items'   => $result,
                'data'    => $result,
                'total'   => $result->count(),
                'summary' => $summary,
            ]);
        }

        $total = $result->count();
        $perPage = (int) $request->input('per_page', 10);
        $page = (int) $request->input('page', 1);
        $slice = $result->slice(($page - 1) * $perPage, $perPage)->values();

        $paginated = new \Illuminate\Pagination\LengthAwarePaginator(
            $slice,
            $total,
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        return response()->json([
            'items'        => $slice,
            'data'         => $slice,
            'current_page' => $paginated->currentPage(),
            'last_page'    => $paginated->lastPage(),
            'per_page'     => $paginated->perPage(),
            'total'        => $paginated->total(),
            'from'         => $paginated->firstItem(),
            'to'           => $paginated->lastItem(),
            'summary'      => $summary,
        ]);
    }

    /**
     * GET /api/inventory/item-options
     *
     * Complete, NEVER paginated list of items for dropdowns (Stock In, Stock Out, filters).
     * Includes items with zero stock so they can be restocked. Reads live from the database,
     * so an item created in the Items module is available immediately.
     *
     * Query: status=active|all (default active), stockable=1|0 (default 1 = Medicine + Supply;
     * Equipment is not tracked by quantity so it cannot be stocked in/out).
     */
    public function itemOptions(Request $request): JsonResponse
    {
        $q = InventoryItem::query();

        if ($request->input('status', 'active') !== 'all') {
            $q->where('is_active', true);
        }
        if ($request->boolean('stockable', true)) {
            $q->where('category', '!=', 'Equipment');
        }

        $stock = $this->stockByItem();

        $items = $q->orderBy('name')
            ->get(['id', 'name', 'category', 'unit', 'reorder_level', 'is_active'])
            ->map(function (InventoryItem $item) use ($stock) {
                $isEquipment = $item->category === 'Equipment';
                $current     = $isEquipment ? null : ($stock[$item->id] ?? 0);

                return [
                    'id'              => $item->id,
                    'name'            => $item->name,
                    'category'        => $item->category,
                    'unit'            => $item->unit,
                    'reorder_level'   => $item->reorder_level,
                    'is_active'       => $item->is_active,
                    'current_stock'   => $current,
                    'is_low_stock'    => !$isEquipment && $current > 0 && $current <= $item->reorder_level,
                    'is_out_of_stock' => !$isEquipment && $current === 0,
                ];
            })
            ->values();

        return response()->json(['items' => $items, 'total' => $items->count()]);
    }

    public function itemStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            // One record per item: restock an existing item with Stock In instead of adding it twice.
            'name'             => ['required', 'string', 'max:255', Rule::unique('inventory_items', 'name')],
            'category'         => ['required', 'in:Medicine,Supply,Equipment'],
            'unit'             => ['required', 'string', 'max:50'],
            'reorder_level'    => ['required', 'integer', 'min:0'],
            'is_active'        => ['boolean'],
            'equipment_status' => ['nullable', 'in:Available,In Use,Under Repair,Retired'],
            'location'         => ['nullable', 'string', 'max:255'],
            'description'      => ['nullable', 'string'],
        ], [
            'name.unique' => 'An item with this name already exists. Use Stock In to restock it instead of adding it again.',
        ]);

        if (!isset($validated['is_active'])) {
            $validated['is_active'] = true;
        }

        $item = InventoryItem::create($validated);

        AuditLogger::log('inventory_item_created', InventoryItem::class, $item->id, null, $item->toArray());

        return response()->json(['item' => $this->withStock($item)], 201);
    }

    public function itemUpdate(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        $validated = $request->validate([
            'name'             => ['required', 'string', 'max:255', Rule::unique('inventory_items', 'name')->ignore($inventoryItem->id)],
            'category'         => ['required', 'in:Medicine,Supply,Equipment'],
            'unit'             => ['required', 'string', 'max:50'],
            'reorder_level'    => ['required', 'integer', 'min:0'],
            'is_active'        => ['boolean'],
            'equipment_status' => ['nullable', 'in:Available,In Use,Under Repair,Retired'],
            'location'         => ['nullable', 'string', 'max:255'],
            'description'      => ['nullable', 'string'],
        ], [
            'name.unique' => 'Another item already uses this name.',
        ]);

        $old = $inventoryItem->toArray();
        $inventoryItem->update($validated);

        AuditLogger::log('inventory_item_updated', InventoryItem::class, $inventoryItem->id, $old, $inventoryItem->getChanges());

        return response()->json(['item' => $this->withStock($inventoryItem->fresh())]);
    }

    public function itemToggle(InventoryItem $inventoryItem): JsonResponse
    {
        $inventoryItem->update(['is_active' => !$inventoryItem->is_active]);
        AuditLogger::log('inventory_item_toggled', InventoryItem::class, $inventoryItem->id, null, ['is_active' => $inventoryItem->is_active]);
        return response()->json(['item' => $this->withStock($inventoryItem)]);
    }

    // ── Batches (Stock In) ────────────────────────────────────────────────

    /**
     * GET /api/inventory/batches — Stock In history.
     *
     * Filtering, searching and sorting run in the database BEFORE pagination, so page
     * numbers and totals always match what the user sees.
     *
     * Query: item_id, search (item name / batch no. / supplier), category (Medicine|Supply),
     *        received_from, received_to (received date, inclusive),
     *        sort_by = item | quantity_in | remaining | expiry | received (default), sort_dir = asc | desc (default desc),
     *        page, per_page (max 100)   — or all=true for an unpaginated list.
     */
    public function batchIndex(Request $request): JsonResponse
    {
        $request->validate([
            'received_from' => ['nullable', 'date'],
            'received_to'   => ['nullable', 'date'],
            'category'      => ['nullable', 'in:Medicine,Supply,Equipment,all'],
            'sort_by'       => ['nullable', 'in:item,quantity_in,remaining,expiry,received'],
            'sort_dir'      => ['nullable', 'in:asc,desc'],
        ]);

        $q = InventoryBatch::with(['item', 'receivedBy']);

        if ($request->filled('item_id')) {
            $q->where('item_id', $request->item_id);
        }

        if ($request->filled('category') && $request->category !== 'all') {
            $category = $request->category;
            $q->whereHas('item', fn ($iq) => $iq->where('category', $category));
        }

        if ($request->filled('search')) {
            $search = '%' . trim($request->input('search')) . '%';
            $q->where(function ($sub) use ($search) {
                $sub->where('batch_no', 'like', $search)
                    ->orWhere('supplier', 'like', $search)
                    ->orWhereHas('item', fn ($iq) => $iq->where('name', 'like', $search));
            });
        }

        if ($request->filled('received_from')) {
            $q->whereDate('received_date', '>=', $request->received_from);
        }
        if ($request->filled('received_to')) {
            $q->whereDate('received_date', '<=', $request->received_to);
        }

        // Sorting (clickable column headers). Default: newest received first.
        // The id is always the final key, in the same direction, so pages never repeat or skip rows.
        $dir = $request->input('sort_dir') === 'asc' ? 'asc' : 'desc';
        switch ($request->input('sort_by', 'received')) {
            case 'item':
                $q->orderBy(
                    InventoryItem::select('name')->whereColumn('inventory_items.id', 'inventory_batches.item_id'),
                    $dir
                )->orderByDesc('received_date');
                break;
            case 'quantity_in':
                $q->orderBy('quantity_in', $dir);
                break;
            case 'remaining':
                $q->orderByRaw('(quantity_in - quantity_used) ' . $dir);
                break;
            case 'expiry':       // batches without an expiry date always go last
                $q->orderByRaw('expiry_date IS NULL')->orderBy('expiry_date', $dir)->orderByDesc('received_date');
                break;
            case 'received':
            default:
                $q->orderBy('received_date', $dir)->orderBy('created_at', $dir);
        }
        $q->orderBy('id', $dir);

        $today    = now()->toDateString();
        $in30Days = now()->addDays(30)->toDateString();

        $format = function (InventoryBatch $b) use ($today, $in30Days) {
            $data                     = $b->toArray();
            $data['expiry_date']      = $b->expiry_date ? $b->expiry_date->toDateString() : null;
            $data['received_date']    = $b->received_date ? $b->received_date->toDateString() : null;
            $data['remaining']        = max(0, $b->quantity_in - $b->quantity_used);
            $data['is_expired']       = $b->expiry_date && $b->expiry_date->toDateString() <= $today;
            $data['is_expiring_soon'] = $b->expiry_date
                && $b->expiry_date->toDateString() > $today
                && $b->expiry_date->toDateString() <= $in30Days;
            return $data;
        };

        if ($request->boolean('all') || $request->input('paginate') === 'false') {
            $batches = $q->get()->map($format);

            return response()->json([
                'batches' => $batches,
                'data'    => $batches,
                'total'   => $batches->count(),
            ]);
        }

        $perPage   = max(1, min(100, (int) $request->input('per_page', 10)));
        $paginated = $q->paginate($perPage);
        $items     = collect($paginated->items())->map($format);

        return response()->json([
            'batches'      => $items,
            'data'         => $items,
            'current_page' => $paginated->currentPage(),
            'last_page'    => $paginated->lastPage(),
            'per_page'     => $paginated->perPage(),
            'total'        => $paginated->total(),
            'from'         => $paginated->firstItem(),
            'to'           => $paginated->lastItem(),
        ]);
    }

    /**
     * POST /api/inventory/batches — receive stock for an EXISTING item.
     *
     * Never creates an item: it adds a batch + an IN transaction to the item's own record,
     * and current stock (IN minus OUT) is recalculated from those transactions.
     * Both rows are written in one DB transaction so they cannot get out of sync.
     */
    public function batchStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'item_id'       => ['required', 'exists:inventory_items,id'],
            'batch_no'      => ['nullable', 'string', 'max:100'],
            'supplier'      => ['nullable', 'string', 'max:255'],
            'quantity_in'   => ['required', 'integer', 'min:1'],
            'expiry_date'   => ['nullable', 'date'],
            'received_date' => ['nullable', 'date'],
            'notes'         => ['nullable', 'string'],
        ]);

        $user = $request->user();
        $item = InventoryItem::findOrFail($validated['item_id']);

        if (!$item->is_active) {
            return response()->json(['message' => "\"{$item->name}\" is inactive. Activate it in Items before receiving stock."], 422);
        }
        if ($item->category === 'Equipment') {
            return response()->json(['message' => 'Equipment is not tracked by quantity, so stock cannot be received for it.'], 422);
        }

        // Medicine requires expiry date
        if ($item->category === 'Medicine' && empty($validated['expiry_date'])) {
            return response()->json(['message' => 'Expiry date is required for medicine items.'], 422);
        }

        $receivedDate = $validated['received_date'] ?? now()->toDateString();

        $batch = DB::transaction(function () use ($validated, $item, $user, $receivedDate) {
            $batch = InventoryBatch::create([
                ...$validated,
                'quantity_used' => 0,
                'received_by'   => $user->id,
                'received_date' => $receivedDate,
            ]);

            // Auto-create IN transaction
            InventoryTransaction::create([
                'item_id'          => $item->id,
                'batch_id'         => $batch->id,
                'type'             => 'IN',
                'quantity'         => $validated['quantity_in'],
                'reason'           => 'Stock In',
                'recorded_by'      => $user->id,
                'transaction_date' => $receivedDate,
                'notes'            => $validated['notes'] ?? null,
            ]);

            return $batch;
        });

        AuditLogger::log('inventory_stock_in', InventoryBatch::class, $batch->id, null, $batch->toArray());

        return response()->json([
            'batch'      => $batch->load(['item', 'receivedBy']),
            'item_stock' => $this->getStock($item->id),
            'message'    => 'Stock received and recorded successfully.',
        ], 201);
    }

    // ── Transactions ──────────────────────────────────────────────────────

    /**
     * GET /api/inventory/transactions — stock movement history (Stock Out + Transactions pages).
     *
     * Query: item_id, type (IN|OUT), category (Medicine|Supply|Equipment),
     *        search (item name / reason / notes / batch no.),
     *        date_from, date_to (transaction date, inclusive),
     *        sort_by = date (default) | item | type | quantity | reason, sort_dir = asc | desc (default desc),
     *        page, per_page (max 100) — or all=true for an unpaginated list (CSV export).
     */
    public function transactionIndex(Request $request): JsonResponse
    {
        $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to'   => ['nullable', 'date'],
            'category'  => ['nullable', 'in:Medicine,Supply,Equipment,all'],
            'sort_by'   => ['nullable', 'in:date,item,type,quantity,reason'],
            'sort_dir'  => ['nullable', 'in:asc,desc'],
        ]);

        $q = InventoryTransaction::with(['item', 'batch', 'recordedBy', 'patientUser']);

        if ($request->has('item_id') && $request->item_id) {
            $q->where('item_id', $request->item_id);
        }

        if ($request->has('type') && in_array($request->type, ['IN', 'OUT'])) {
            $q->where('type', $request->type);
        }

        if ($request->filled('category') && $request->category !== 'all') {
            $category = $request->category;
            $q->whereHas('item', fn ($iq) => $iq->where('category', $category));
        }

        if ($request->has('date_from') && $request->date_from) {
            $q->where('transaction_date', '>=', $request->date_from);
        }

        if ($request->has('date_to') && $request->date_to) {
            $q->where('transaction_date', '<=', $request->date_to);
        }

        if ($request->filled('search')) {
            $search = '%' . trim($request->input('search')) . '%';
            $q->where(function ($sub) use ($search) {
                $sub->where('reason', 'like', $search)
                    ->orWhere('notes', 'like', $search)
                    ->orWhereHas('item', fn ($iq) => $iq->where('name', 'like', $search))
                    ->orWhereHas('batch', fn ($bq) => $bq->where('batch_no', 'like', $search));
            });
        }

        // Sorting (clickable column headers). Default: newest first.
        // The id is the final key, in the same direction, so pages never repeat or skip rows.
        $dir = $request->input('sort_dir') === 'asc' ? 'asc' : 'desc';
        switch ($request->input('sort_by', 'date')) {
            case 'item':
                $q->orderBy(
                    InventoryItem::select('name')->whereColumn('inventory_items.id', 'inventory_transactions.item_id'),
                    $dir
                )->orderByDesc('transaction_date');
                break;
            // `type` and `reason` are MySQL ENUMs, which sort by definition order, not alphabetically.
            // CAST to text so the ▲/▼ arrow really means A→Z / Z→A.
            case 'type':
                $q->orderByRaw('CAST(type AS CHAR) ' . $dir)->orderByDesc('transaction_date');
                break;
            case 'quantity':
                $q->orderBy('quantity', $dir);
                break;
            case 'reason':
                $q->orderByRaw('CAST(reason AS CHAR) ' . $dir)->orderByDesc('transaction_date');
                break;
            case 'date':
            default:
                $q->orderBy('transaction_date', $dir)->orderBy('created_at', $dir);
        }
        $q->orderBy('id', $dir);

        if ($request->boolean('all')) {
            $rows = $q->get();
            return response()->json(['data' => $rows, 'total' => $rows->count()]);
        }

        $perPage      = max(1, min(100, (int) $request->input('per_page', 10)));
        $transactions = $q->paginate($perPage);

        return response()->json($transactions);
    }

    // ── Stock deduction ───────────────────────────────────────────────────
    //
    // Manual stock-out and consultation dispensing share the helpers below. Rules:
    //   * Always run inside DB::transaction(). The item rows are locked first (lowest id first), so two
    //     requests that touch the same item run one after the other and the second sees the first one's
    //     result. Stock is then read with a locking read, which always sees the latest committed rows.
    //   * Stock is taken from batches, earliest expiry first, and ONE OUT transaction is written for
    //     every batch it was taken from. A batch's quantity_used therefore always matches its rows,
    //     and reversing a row gives back exactly what that row took.
    //   * If the batches cannot cover the quantity, InsufficientStockException is thrown and the whole
    //     transaction rolls back.

    /**
     * Lock the given item rows, lowest id first so two requests can never wait on each other in a circle.
     * Call inside DB::transaction(). While the locks are held, nobody else can change these items' stock.
     *
     * @param  int[]  $itemIds
     * @return \Illuminate\Support\Collection<int,InventoryItem>  keyed by item id
     */
    public static function lockItems(array $itemIds)
    {
        $ids = array_values(array_unique(array_map('intval', $itemIds)));
        sort($ids);

        if (! $ids) {
            return collect();
        }

        return InventoryItem::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
    }

    /**
     * Current stock of an item (IN minus OUT), read with a locking read so it always sees the latest
     * committed ledger rows (a plain SELECT inside a transaction can read an older snapshot).
     */
    private static function stockLocked(int $itemId): int
    {
        $row = InventoryTransaction::where('item_id', $itemId)
            ->lockForUpdate()
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity WHEN type = 'OUT' THEN -quantity ELSE 0 END), 0) AS stock")
            ->first();

        return max(0, (int) $row->stock);
    }

    /**
     * Take $quantity of an item from its batches and record ONE OUT transaction per batch slice.
     *
     * @param  array        $txAttributes     columns shared by every row (reason, recorded_by, transaction_date, notes, consultation_*)
     * @param  int|null     $preferredBatchId taken first, even if expired (manual stock-out of a chosen batch)
     * @param  bool         $includeExpired   medicines past their expiry date are skipped unless true (write-offs)
     * @return InventoryTransaction[]
     *
     * @throws InsufficientStockException when the batches cannot cover the quantity
     */
    private static function deductFromBatches(InventoryItem $item, int $quantity, array $txAttributes, ?int $preferredBatchId = null, bool $includeExpired = false): array
    {
        $batches = InventoryBatch::where('item_id', $item->id)
            ->where('quantity_in', '>', DB::raw('quantity_used'))
            ->when($item->category === 'Medicine' && ! $includeExpired, fn ($q) => $q->where('expiry_date', '>=', now()->toDateString()))
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        if ($preferredBatchId) {
            $preferred = InventoryBatch::where('id', $preferredBatchId)
                ->where('item_id', $item->id)
                ->where('quantity_in', '>', DB::raw('quantity_used'))
                ->lockForUpdate()
                ->first();

            if ($preferred) {
                $batches = $batches->reject(fn ($b) => $b->id === $preferred->id)->prepend($preferred)->values();
            }
        }

        $remaining = $quantity;
        $created   = [];

        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }

            $take = min($remaining, $batch->quantity_in - $batch->quantity_used);
            if ($take <= 0) {
                continue;
            }

            $batch->increment('quantity_used', $take);

            $created[] = InventoryTransaction::create($txAttributes + [
                'item_id'  => $item->id,
                'batch_id' => $batch->id,
                'type'     => 'OUT',
                'quantity' => $take,
            ]);

            $remaining -= $take;
        }

        if ($remaining > 0) {
            $usable = $quantity - $remaining;
            throw new InsufficientStockException([
                "Insufficient usable stock for \"{$item->name}\" (available in batches that can be used: {$usable} {$item->unit}, requested: {$quantity})."
                . ($item->category === 'Medicine' ? ' Expired medicine cannot be dispensed.' : ''),
            ]);
        }

        return $created;
    }

    /**
     * Manual OUT transaction (stock out / write-off / adjustment).
     */
    public function stockOut(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'item_id'  => ['required', 'exists:inventory_items,id'],
            'batch_id' => ['nullable', 'exists:inventory_batches,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'reason'   => ['required', 'in:Dispensed,Used in clinic,Expired,Damaged,Adjustment'],
            'notes'    => ['nullable', 'string'],
            'transaction_date' => ['nullable', 'date'],
        ]);

        $user   = $request->user();
        $txDate = $validated['transaction_date'] ?? now()->toDateString();

        $transactions = DB::transaction(function () use ($validated, $user, $txDate) {
            $item  = self::lockItems([(int) $validated['item_id']])->get((int) $validated['item_id']);
            $stock = self::stockLocked($item->id);

            if ($validated['quantity'] > $stock) {
                throw new InsufficientStockException(["Insufficient stock. Current stock: {$stock} {$item->unit}."]);
            }

            return self::deductFromBatches(
                $item,
                (int) $validated['quantity'],
                [
                    'reason'           => $validated['reason'],
                    'recorded_by'      => $user->id,
                    'transaction_date' => $txDate,
                    'notes'            => $validated['notes'] ?? null,
                ],
                ! empty($validated['batch_id']) ? (int) $validated['batch_id'] : null,
                $validated['reason'] === 'Expired'
            );
        }, 3);

        foreach ($transactions as $tx) {
            AuditLogger::log('inventory_stock_out', InventoryTransaction::class, $tx->id, null, $tx->toArray());
        }

        return response()->json([
            'transaction'  => $transactions[0]->load(['item', 'batch', 'recordedBy']),   // first batch slice (kept for older callers)
            'transactions' => collect($transactions)->each->load(['item', 'batch', 'recordedBy'])->values(),
            'message'      => 'Stock out recorded successfully.',
        ], 201);
    }

    // ── Consultation Dispense ─────────────────────────────────────────────

    /**
     * Dispense the items of a consultation: checks the stock under lock and writes the OUT transactions
     * (one per batch slice, see deductFromBatches). Call it inside the DB::transaction() that saves the
     * consultation, so that if any item cannot be covered the consultation is not saved either.
     *
     * $items = [['item_id' => x, 'quantity' => y, 'dosage_note' => '...'], ...]
     *
     * @return InventoryTransaction[]
     * @throws InsufficientStockException listing every item that cannot be covered
     */
    public static function dispenseForConsultation(
        array  $items,
        string $consultationType, // 'medical' | 'dental'
        int    $consultationId,
        int    $patientUserId,
        int    $recordedByUserId,
        string $txDate
    ): array {
        // One entry per item (the same item listed twice is added up)
        $wanted = [];
        foreach ($items as $row) {
            $itemId = (int) ($row['item_id'] ?? 0);
            $qty    = (int) ($row['quantity'] ?? 0);
            if ($itemId <= 0 || $qty <= 0) {
                continue;
            }
            $wanted[$itemId]['quantity']    = ($wanted[$itemId]['quantity'] ?? 0) + $qty;
            $wanted[$itemId]['dosage_note'] = $wanted[$itemId]['dosage_note'] ?? (trim((string) ($row['dosage_note'] ?? '')) ?: null);
        }

        if (! $wanted) {
            return [];
        }

        $locked = self::lockItems(array_keys($wanted));

        // 1. Check everything first, so the message lists every item that is short
        $errors = [];
        foreach ($wanted as $itemId => $w) {
            $item = $locked->get($itemId);
            if (! $item) {
                continue;
            }
            $stock = self::stockLocked($itemId);
            if ($w['quantity'] > $stock) {
                $errors[] = "Insufficient stock for \"{$item->name}\" (available: {$stock} {$item->unit}, requested: {$w['quantity']}).";
            }
        }
        if ($errors) {
            throw new InsufficientStockException($errors);
        }

        // 2. Take the stock, one OUT row per batch
        $created = [];
        foreach ($wanted as $itemId => $w) {
            $item = $locked->get($itemId);
            if (! $item) {
                continue;
            }

            $rows = self::deductFromBatches($item, $w['quantity'], [
                'reason'            => 'Dispensed',
                'consultation_type' => $consultationType,
                'consultation_id'   => $consultationId,
                'patient_user_id'   => $patientUserId,
                'recorded_by'       => $recordedByUserId,
                'transaction_date'  => $txDate,
                'notes'             => $w['dosage_note'],
            ]);

            AuditLogger::log('inventory_dispensed', InventoryTransaction::class, $rows[0]->id, null, [
                'item_id'           => $item->id,
                'item_name'         => $item->name,
                'quantity'          => $w['quantity'],
                'batches'           => collect($rows)->map(fn ($r) => ['batch_id' => $r->batch_id, 'quantity' => $r->quantity])->all(),
                'consultation_type' => $consultationType,
                'consultation_id'   => $consultationId,
                'dosage_note'       => $w['dosage_note'],
            ]);

            $created = array_merge($created, $rows);
        }

        return $created;
    }

    /**
     * Lock the items a consultation already dispensed plus the items it is about to dispense.
     * An edit calls this first, so every lock is taken in one sorted pass before anything is reversed.
     */
    public static function lockConsultationItems(string $consultationType, int $consultationId, array $newItems): void
    {
        $oldIds = InventoryTransaction::where('consultation_type', $consultationType)
            ->where('consultation_id', $consultationId)
            ->where('type', 'OUT')
            ->pluck('item_id')
            ->all();

        self::lockItems(array_merge($oldIds, array_map(fn ($r) => (int) ($r['item_id'] ?? 0), $newItems)));
    }

    /**
     * Reverse (delete) the OUT transactions of a consultation and give each batch back exactly what
     * its own row took. Call inside DB::transaction().
     */
    public static function reverseConsultationTransactions(string $consultationType, int $consultationId): void
    {
        $query = fn () => InventoryTransaction::where('consultation_type', $consultationType)
            ->where('consultation_id', $consultationId)
            ->where('type', 'OUT');

        self::lockItems($query()->pluck('item_id')->all());

        foreach ($query()->lockForUpdate()->get() as $tx) {
            if ($tx->batch_id) {
                // never below zero, even for older rows that were written for several batches at once
                InventoryBatch::where('id', $tx->batch_id)
                    ->update(['quantity_used' => DB::raw('GREATEST(quantity_used - ' . (int) $tx->quantity . ', 0)')]);
            }
            $tx->delete();
        }
    }

    /**
     * Get dispensed items for a consultation (for display in the form).
     * An item taken from several batches has several rows; the form shows it once with the total.
     */
    public function consultationItems(Request $request): JsonResponse
    {
        $type = $request->query('consultation_type');
        $id   = $request->query('consultation_id');

        $txns = InventoryTransaction::with(['item'])
            ->where('consultation_type', $type)
            ->where('consultation_id', $id)
            ->where('type', 'OUT')
            ->where('reason', 'Dispensed')
            ->orderBy('id')
            ->get()
            ->groupBy('item_id')
            ->map(fn ($rows) => [
                'item_id'     => $rows->first()->item_id,
                'item_name'   => $rows->first()->item->name ?? '',
                'unit'        => $rows->first()->item->unit ?? '',
                'quantity'    => $rows->sum('quantity'),
                'dosage_note' => $rows->pluck('notes')->filter()->first(),
            ])
            ->values();

        return response()->json(['items' => $txns]);
    }

    /**
     * Return list of active, in-stock (non-expired) Medicine + Supply items for the dispense picker.
     */
    public function dispensableItems(Request $request): JsonResponse
    {
        $today = now()->toDateString();

        $q = InventoryItem::where('is_active', true)
            ->whereIn('category', ['Medicine', 'Supply']);

        // Search by name or category
        if ($request->has('search') && $request->search !== '') {
            $search = $request->search;
            $q->where(function ($query) use ($search) {
                $query->where('name', 'like', "%{$search}%")
                      ->orWhere('category', 'like', "%{$search}%");
            });
        }

        $items = $q->orderBy('category')
            ->orderBy('name')
            ->get()
            ->map(function ($item) use ($today) {
                $stock = (new self)->getStock($item->id);

                // Check if any non-expired batch exists
                $hasStock = $stock > 0;

                return [
                    'id'            => $item->id,
                    'name'          => $item->name,
                    'category'      => $item->category,
                    'unit'          => $item->unit,
                    'current_stock' => $stock,
                    'has_stock'     => $hasStock,
                ];
            });

        return response()->json(['items' => $items]);
    }

    /**
     * Check inventory for low stock and expiring/expired items and create notifications
     * for admin users, ensuring no duplicates for the same item per day.
     */
    public static function checkAlertsAndNotifyAdmins(): void
    {
        try {
            $admins = User::where('role', 'admin')->where('is_active', true)->get();
            if ($admins->isEmpty()) {
                return;
            }

            $today = now()->toDateString();
            $in30Days = now()->addDays(30)->toDateString();

            // 1. Low stock items
            $items = InventoryItem::where('category', '!=', 'Equipment')
                ->where('is_active', true)
                ->get();

            // Stock of every item from ONE grouped query (was two queries per item)
            $stockByItem = InventoryTransaction::query()
                ->selectRaw("item_id, SUM(CASE WHEN type = 'IN' THEN quantity WHEN type = 'OUT' THEN -quantity ELSE 0 END) AS stock")
                ->groupBy('item_id')
                ->pluck('stock', 'item_id');

            foreach ($items as $item) {
                $stock = max(0, (int) ($stockByItem[$item->id] ?? 0));

                if ($stock <= $item->reorder_level) {
                    foreach ($admins as $admin) {
                        $alreadyNotified = Notification::where('user_id', $admin->id)
                            ->where('target_type', 'inventory_item')
                            ->where('target_id', $item->id)
                            ->where('type', 'warning')
                            ->whereDate('created_at', $today)
                            ->exists();

                        if (!$alreadyNotified) {
                            Notification::create([
                                'user_id'     => $admin->id,
                                'title'       => 'Low Stock Alert',
                                'message'     => "\"{$item->name}\" is low on stock ({$stock} {$item->unit} remaining, reorder level is {$item->reorder_level}).",
                                'type'        => 'warning',
                                'target_type' => 'inventory_item',
                                'target_id'   => $item->id,
                                'action_url'  => "/clinic/inventory/items?search=" . urlencode($item->name),
                                'is_read'     => false,
                            ]);
                        }
                    }
                }
            }

            // 2. Expiring soon and expired batches
            $batches = InventoryBatch::with('item')
                ->whereNotNull('expiry_date')
                ->where('quantity_in', '>', DB::raw('quantity_used'))
                ->get();

            foreach ($batches as $batch) {
                if (!$batch->item) continue;
                $expStr = $batch->expiry_date->toDateString();
                $isExpired = $expStr <= $today;
                $isExpiringSoon = !$isExpired && ($expStr <= $in30Days);

                if ($isExpired || $isExpiringSoon) {
                    $alertType = $isExpired ? 'error' : 'warning';
                    $title     = $isExpired ? 'Expired Item Alert' : 'Expiring Soon Alert';
                    $remaining = max(0, $batch->quantity_in - $batch->quantity_used);
                    $msgText   = $isExpired
                        ? "\"{$batch->item->name}\" (Batch: {$batch->batch_no}) expired on {$expStr} ({$remaining} {$batch->item->unit} remaining)."
                        : "\"{$batch->item->name}\" (Batch: {$batch->batch_no}) expires on {$expStr} ({$remaining} {$batch->item->unit} remaining).";

                    foreach ($admins as $admin) {
                        $alreadyNotified = Notification::where('user_id', $admin->id)
                            ->where('target_type', 'inventory_item')
                            ->where('target_id', $batch->item_id)
                            ->where('title', $title)
                            ->whereDate('created_at', $today)
                            ->exists();

                        if (!$alreadyNotified) {
                            Notification::create([
                                'user_id'     => $admin->id,
                                'title'       => $title,
                                'message'     => $msgText,
                                'type'        => $alertType,
                                'target_type' => 'inventory_item',
                                'target_id'   => $batch->item_id,
                                'action_url'  => "/clinic/inventory/items?search=" . urlencode($batch->item->name),
                                'is_read'     => false,
                            ]);
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::error('Failed to run checkAlertsAndNotifyAdmins: ' . $e->getMessage(), [
                'exception' => $e,
            ]);
        }
    }
}
