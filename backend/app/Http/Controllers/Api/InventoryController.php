<?php

namespace App\Http\Controllers\Api;

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

class InventoryController extends Controller
{
    // ── Shared helpers ────────────────────────────────────────────────────

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

    public function itemStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'             => ['required', 'string', 'max:255'],
            'category'         => ['required', 'in:Medicine,Supply,Equipment'],
            'unit'             => ['required', 'string', 'max:50'],
            'reorder_level'    => ['required', 'integer', 'min:0'],
            'is_active'        => ['boolean'],
            'equipment_status' => ['nullable', 'in:Available,In Use,Under Repair,Retired'],
            'location'         => ['nullable', 'string', 'max:255'],
            'description'      => ['nullable', 'string'],
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
            'name'             => ['required', 'string', 'max:255'],
            'category'         => ['required', 'in:Medicine,Supply,Equipment'],
            'unit'             => ['required', 'string', 'max:50'],
            'reorder_level'    => ['required', 'integer', 'min:0'],
            'is_active'        => ['boolean'],
            'equipment_status' => ['nullable', 'in:Available,In Use,Under Repair,Retired'],
            'location'         => ['nullable', 'string', 'max:255'],
            'description'      => ['nullable', 'string'],
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

    public function batchIndex(Request $request): JsonResponse
    {
        $q = InventoryBatch::with(['item', 'receivedBy']);

        if ($request->has('item_id') && $request->item_id) {
            $q->where('item_id', $request->item_id);
        }

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $q->where(function ($sub) use ($search) {
                $sub->where('batch_no', 'like', $search)
                    ->orWhere('supplier', 'like', $search)
                    ->orWhereHas('item', function ($iq) use ($search) {
                        $iq->where('name', 'like', $search);
                    });
            });
        }

        $today    = now()->toDateString();
        $in30Days = now()->addDays(30)->toDateString();

        if ($request->boolean('all') || $request->input('paginate') === 'false') {
            $batches = $q->orderByDesc('created_at')->get()->map(function ($b) use ($today, $in30Days) {
                $data                  = $b->toArray();
                $data['expiry_date']   = $b->expiry_date ? $b->expiry_date->toDateString() : null;
                $data['received_date'] = $b->received_date ? $b->received_date->toDateString() : null;
                $data['remaining']     = max(0, $b->quantity_in - $b->quantity_used);
                $data['is_expired']    = $b->expiry_date && $b->expiry_date->toDateString() <= $today;
                $data['is_expiring_soon'] = $b->expiry_date
                    && $b->expiry_date->toDateString() > $today
                    && $b->expiry_date->toDateString() <= $in30Days;
                return $data;
            });

            return response()->json([
                'batches' => $batches,
                'data'    => $batches,
                'total'   => $batches->count(),
            ]);
        }

        $perPage = (int) $request->input('per_page', 10);
        $paginated = $q->orderByDesc('created_at')->paginate($perPage);

        $items = collect($paginated->items())->map(function ($b) use ($today, $in30Days) {
            $data                  = $b->toArray();
            $data['expiry_date']   = $b->expiry_date ? $b->expiry_date->toDateString() : null;
            $data['received_date'] = $b->received_date ? $b->received_date->toDateString() : null;
            $data['remaining']     = max(0, $b->quantity_in - $b->quantity_used);
            $data['is_expired']    = $b->expiry_date && $b->expiry_date->toDateString() <= $today;
            $data['is_expiring_soon'] = $b->expiry_date
                && $b->expiry_date->toDateString() > $today
                && $b->expiry_date->toDateString() <= $in30Days;
            return $data;
        });

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

        $user  = $request->user();
        $item  = InventoryItem::findOrFail($validated['item_id']);

        // Medicine requires expiry date
        if ($item->category === 'Medicine' && empty($validated['expiry_date'])) {
            return response()->json(['message' => 'Expiry date is required for medicine items.'], 422);
        }

        $batch = InventoryBatch::create([
            ...$validated,
            'quantity_used' => 0,
            'received_by'   => $user->id,
            'received_date' => $validated['received_date'] ?? now()->toDateString(),
        ]);

        // Auto-create IN transaction
        InventoryTransaction::create([
            'item_id'          => $item->id,
            'batch_id'         => $batch->id,
            'type'             => 'IN',
            'quantity'         => $validated['quantity_in'],
            'reason'           => 'Stock In',
            'recorded_by'      => $user->id,
            'transaction_date' => $validated['received_date'] ?? now()->toDateString(),
            'notes'            => $validated['notes'] ?? null,
        ]);

        AuditLogger::log('inventory_stock_in', InventoryBatch::class, $batch->id, null, $batch->toArray());

        return response()->json([
            'batch'   => $batch->load(['item', 'receivedBy']),
            'message' => 'Stock received and recorded successfully.',
        ], 201);
    }

    // ── Transactions ──────────────────────────────────────────────────────

    public function transactionIndex(Request $request): JsonResponse
    {
        $q = InventoryTransaction::with(['item', 'batch', 'recordedBy', 'patientUser']);

        if ($request->has('item_id') && $request->item_id) {
            $q->where('item_id', $request->item_id);
        }

        if ($request->has('type') && in_array($request->type, ['IN', 'OUT'])) {
            $q->where('type', $request->type);
        }

        if ($request->has('date_from') && $request->date_from) {
            $q->where('transaction_date', '>=', $request->date_from);
        }

        if ($request->has('date_to') && $request->date_to) {
            $q->where('transaction_date', '<=', $request->date_to);
        }

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $q->where(function ($sub) use ($search) {
                $sub->where('reason', 'like', $search)
                    ->orWhere('notes', 'like', $search)
                    ->orWhereHas('item', function ($iq) use ($search) {
                        $iq->where('name', 'like', $search);
                    });
            });
        }

        $perPage = (int) $request->input('per_page', 10);
        $transactions = $q->orderByDesc('created_at')->paginate($perPage);

        return response()->json($transactions);
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

        $user  = $request->user();
        $item  = InventoryItem::findOrFail($validated['item_id']);
        $stock = $this->getStock($item->id);

        if ($validated['quantity'] > $stock) {
            return response()->json([
                'message' => "Insufficient stock. Current stock: {$stock} {$item->unit}.",
            ], 422);
        }

        $txDate    = $validated['transaction_date'] ?? now()->toDateString();
        $remaining = $validated['quantity'];
        $usedBatchId = null;

        if (!empty($validated['batch_id'])) {
            $targetBatch = InventoryBatch::where('id', $validated['batch_id'])->where('item_id', $item->id)->first();
            if ($targetBatch) {
                $available = max(0, $targetBatch->quantity_in - $targetBatch->quantity_used);
                $deduct    = min($remaining, $available);
                $targetBatch->increment('quantity_used', $deduct);
                $remaining  -= $deduct;
                $usedBatchId = $targetBatch->id;
            }
        }

        // Deduct remaining from earliest-expiry-first batches
        if ($remaining > 0) {
            $batches = InventoryBatch::where('item_id', $item->id)
                ->where('quantity_in', '>', DB::raw('quantity_used'))
                ->when($item->category === 'Medicine' && $validated['reason'] !== 'Expired', fn($q) => $q->where('expiry_date', '>=', now()->toDateString()))
                ->orderBy('expiry_date')
                ->orderBy('id')
                ->get();

            foreach ($batches as $batch) {
                if ($remaining <= 0) break;
                $available   = $batch->quantity_in - $batch->quantity_used;
                $deduct      = min($remaining, $available);
                $batch->increment('quantity_used', $deduct);
                $remaining  -= $deduct;
                $usedBatchId = $batch->id;
            }
        }

        $tx = InventoryTransaction::create([
            'item_id'          => $item->id,
            'batch_id'         => $usedBatchId,
            'type'             => 'OUT',
            'quantity'         => $validated['quantity'],
            'reason'           => $validated['reason'],
            'recorded_by'      => $user->id,
            'transaction_date' => $txDate,
            'notes'            => $validated['notes'] ?? null,
        ]);

        AuditLogger::log('inventory_stock_out', InventoryTransaction::class, $tx->id, null, $tx->toArray());

        return response()->json([
            'transaction' => $tx->load(['item', 'batch', 'recordedBy']),
            'message'     => 'Stock out recorded successfully.',
        ], 201);
    }

    // ── Consultation Dispense ─────────────────────────────────────────────

    /**
     * Create OUT transactions for items dispensed during a consultation.
     * Called automatically from ClinicRecordController / DentalConsultationController.
     *
     * $items = [['item_id' => x, 'quantity' => y], ...]
     * Returns error array if any item can't be dispensed, or empty array on success.
     */
    public static function dispenseForConsultation(
        array  $items,
        string $consultationType, // 'medical' | 'dental'
        int    $consultationId,
        int    $patientUserId,
        int    $recordedByUserId,
        string $txDate
    ): array {
        $errors = [];

        foreach ($items as $row) {
            $item  = InventoryItem::find($row['item_id'] ?? null);
            $qty   = (int) ($row['quantity'] ?? 0);

            if (!$item || $qty <= 0) {
                continue;
            }

            $stock = (new self)->getStock($item->id);

            if ($qty > $stock) {
                $errors[] = "Insufficient stock for \"{$item->name}\" (available: {$stock} {$item->unit}, requested: {$qty}).";
                continue;
            }

            // Deduct earliest-expiry-first
            $remaining = $qty;
            $batches = InventoryBatch::where('item_id', $item->id)
                ->where('quantity_in', '>', DB::raw('quantity_used'))
                ->when($item->category === 'Medicine', fn($q) => $q->where('expiry_date', '>=', now()->toDateString()))
                ->orderBy('expiry_date')
                ->orderBy('id')
                ->get();

            $usedBatchId = null;
            foreach ($batches as $batch) {
                if ($remaining <= 0) break;
                $available  = $batch->quantity_in - $batch->quantity_used;
                $deduct     = min($remaining, $available);
                $batch->increment('quantity_used', $deduct);
                $remaining -= $deduct;
                $usedBatchId = $batch->id;
            }

            $tx = InventoryTransaction::create([
                'item_id'           => $item->id,
                'batch_id'          => $usedBatchId,
                'type'              => 'OUT',
                'quantity'          => $qty,
                'reason'            => 'Dispensed',
                'consultation_type' => $consultationType,
                'consultation_id'   => $consultationId,
                'patient_user_id'   => $patientUserId,
                'recorded_by'       => $recordedByUserId,
                'transaction_date'  => $txDate,
            ]);

            AuditLogger::log('inventory_dispensed', InventoryTransaction::class, $tx->id, null, [
                'item_id'           => $item->id,
                'item_name'         => $item->name,
                'quantity'          => $qty,
                'consultation_type' => $consultationType,
                'consultation_id'   => $consultationId,
            ]);
        }

        return $errors;
    }

    /**
     * Reverse (delete) OUT transactions for a given consultation.
     * Restores quantity_used on the respective batches.
     */
    public static function reverseConsultationTransactions(string $consultationType, int $consultationId): void
    {
        $txns = InventoryTransaction::where('consultation_type', $consultationType)
            ->where('consultation_id', $consultationId)
            ->where('type', 'OUT')
            ->get();

        foreach ($txns as $tx) {
            if ($tx->batch_id) {
                $batch = InventoryBatch::find($tx->batch_id);
                if ($batch) {
                    $batch->decrement('quantity_used', $tx->quantity);
                }
            }
            $tx->delete();
        }
    }

    /**
     * Get dispensed items for a consultation (for display in the form).
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
            ->get()
            ->map(fn($tx) => [
                'item_id'   => $tx->item_id,
                'item_name' => $tx->item->name ?? '',
                'unit'      => $tx->item->unit ?? '',
                'quantity'  => $tx->quantity,
            ]);

        return response()->json(['items' => $txns]);
    }

    /**
     * Return list of active, in-stock (non-expired) Medicine + Supply items for the dispense picker.
     */
    public function dispensableItems(): JsonResponse
    {
        $today = now()->toDateString();

        $items = InventoryItem::where('is_active', true)
            ->whereIn('category', ['Medicine', 'Supply'])
            ->orderBy('category')
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

            foreach ($items as $item) {
                $inQty  = InventoryTransaction::where('item_id', $item->id)->where('type', 'IN')->sum('quantity');
                $outQty = InventoryTransaction::where('item_id', $item->id)->where('type', 'OUT')->sum('quantity');
                $stock  = max(0, $inQty - $outQty);

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
                                'action_url'  => "/admin/inventory/items?search=" . urlencode($item->name),
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
                                'action_url'  => "/admin/inventory/items?search=" . urlencode($batch->item->name),
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
