<?php

namespace Database\Seeders;

use App\Models\InventoryBatch;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Models\User;
use Illuminate\Database\Seeder;

class InventorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $admin = User::roleIs('admin')->first() ?? User::first();
        $adminId = $admin?->id ?? 1;

        // ── 1. MEDICINES ──────────────────────────────────────────────────────
        $medicines = [
            [
                'name' => 'Paracetamol 500mg',
                'unit' => 'tablets',
                'reorder_level' => 100,
                'qty' => 300,
                'months' => 12,
            ],
            [
                'name' => 'Ibuprofen 200mg',
                'unit' => 'tablets',
                'reorder_level' => 50,
                'qty' => 150,
                'months' => 14,
            ],
            [
                'name' => 'Mefenamic Acid 500mg',
                'unit' => 'capsules',
                'reorder_level' => 50,
                'qty' => 120,
                'months' => 10,
            ],
            [
                'name' => 'Cetirizine 10mg',
                'unit' => 'tablets',
                'reorder_level' => 30,
                'qty' => 80,
                'expiring_soon' => true, // Expires within 20 days (e.g. 15 days)
            ],
            [
                'name' => 'Loperamide 2mg',
                'unit' => 'capsules',
                'reorder_level' => 30,
                'qty' => 60,
                'months' => 16,
            ],
            [
                'name' => 'Antacid',
                'unit' => 'tablets',
                'reorder_level' => 50,
                'qty' => 100,
                'months' => 12,
            ],
            [
                'name' => 'Oral Rehydration Salts',
                'unit' => 'sachets',
                'reorder_level' => 20,
                'qty' => 40,
                'months' => 18,
                'low_stock_deduct' => 25, // 40 - 25 = 15 <= 20 (Low Stock #1)
            ],
            [
                'name' => 'Amoxicillin 500mg',
                'unit' => 'capsules',
                'reorder_level' => 30,
                'qty' => 90,
                'months' => 8,
            ],
        ];

        foreach ($medicines as $m) {
            $item = InventoryItem::firstOrCreate(
                ['name' => $m['name']],
                [
                    'category'      => 'Medicine',
                    'unit'          => $m['unit'],
                    'reorder_level' => $m['reorder_level'],
                    'is_active'     => true,
                ]
            );

            $expiry = !empty($m['expiring_soon'])
                ? now()->addDays(15)->toDateString()
                : now()->addMonths($m['months'] ?? 12)->toDateString();

            $batchSlug = strtoupper(substr(preg_replace('/[^a-zA-Z0-9]/', '', $m['name']), 0, 4));
            $batchNo   = "MED-{$batchSlug}-01";

            $batch = InventoryBatch::where('item_id', $item->id)
                ->where(function ($q) use ($batchNo) {
                    $q->where('batch_no', $batchNo)
                      ->orWhere('supplier', 'Initial stock');
                })
                ->first();

            if (!$batch) {
                $batch = InventoryBatch::create([
                    'item_id'       => $item->id,
                    'batch_no'      => $batchNo,
                    'supplier'      => 'Initial stock',
                    'quantity_in'   => $m['qty'],
                    'quantity_used' => 0,
                    'expiry_date'   => $expiry,
                    'received_date' => now()->toDateString(),
                    'received_by'   => $adminId,
                    'notes'         => 'Initial stock batch',
                ]);

                InventoryTransaction::create([
                    'item_id'          => $item->id,
                    'batch_id'         => $batch->id,
                    'type'             => 'IN',
                    'quantity'         => $m['qty'],
                    'reason'           => 'Stock In',
                    'recorded_by'      => $adminId,
                    'transaction_date' => now()->toDateString(),
                    'notes'            => 'Initial stock',
                ]);

                if (!empty($m['low_stock_deduct'])) {
                    $deduct = $m['low_stock_deduct'];
                    $batch->increment('quantity_used', $deduct);
                    InventoryTransaction::create([
                        'item_id'          => $item->id,
                        'batch_id'         => $batch->id,
                        'type'             => 'OUT',
                        'quantity'         => $deduct,
                        'reason'           => 'Used in clinic',
                        'recorded_by'      => $adminId,
                        'transaction_date' => now()->toDateString(),
                        'notes'            => 'Clinic routine usage',
                    ]);
                }
            } else {
                $updates = [];
                if (empty($batch->received_date)) {
                    $updates['received_date'] = now()->toDateString();
                }
                if (empty($batch->expiry_date)) {
                    $updates['expiry_date'] = $expiry;
                }
                if (!empty($updates)) {
                    $batch->update($updates);
                }
            }
        }

        // ── 2. SUPPLIES ───────────────────────────────────────────────────────
        $supplies = [
            ['name' => 'Alcohol 70%', 'unit' => 'bottles', 'reorder_level' => 5, 'qty' => 12, 'months' => 24],
            ['name' => 'Cotton Balls', 'unit' => 'packs', 'reorder_level' => 5, 'qty' => 15],
            ['name' => 'Sterile Gauze Pads', 'unit' => 'boxes', 'reorder_level' => 5, 'qty' => 10],
            ['name' => 'Adhesive Bandages', 'unit' => 'boxes', 'reorder_level' => 5, 'qty' => 10],
            ['name' => 'Disposable Gloves', 'unit' => 'boxes', 'reorder_level' => 5, 'qty' => 8],
            ['name' => 'Disposable Syringes 3mL', 'unit' => 'pieces', 'reorder_level' => 20, 'qty' => 100],
            ['name' => 'Face Masks', 'unit' => 'boxes', 'reorder_level' => 5, 'qty' => 10],
            [
                'name' => 'Povidone-Iodine',
                'unit' => 'bottles',
                'reorder_level' => 3,
                'qty' => 6,
                'months' => 24,
                'low_stock_deduct' => 4, // 6 - 4 = 2 <= 3 (Low Stock #2)
            ],
        ];

        foreach ($supplies as $s) {
            $item = InventoryItem::firstOrCreate(
                ['name' => $s['name']],
                [
                    'category'      => 'Supply',
                    'unit'          => $s['unit'],
                    'reorder_level' => $s['reorder_level'],
                    'is_active'     => true,
                ]
            );

            $expiry = !empty($s['months']) ? now()->addMonths($s['months'])->toDateString() : null;
            $batchSlug = strtoupper(substr(preg_replace('/[^a-zA-Z0-9]/', '', $s['name']), 0, 4));
            $batchNo   = "SUP-{$batchSlug}-01";

            $batch = InventoryBatch::where('item_id', $item->id)
                ->where(function ($q) use ($batchNo) {
                    $q->where('batch_no', $batchNo)
                      ->orWhere('supplier', 'Initial stock');
                })
                ->first();

            if (!$batch) {
                $batch = InventoryBatch::create([
                    'item_id'       => $item->id,
                    'batch_no'      => $batchNo,
                    'supplier'      => 'Initial stock',
                    'quantity_in'   => $s['qty'],
                    'quantity_used' => 0,
                    'expiry_date'   => $expiry,
                    'received_date' => now()->toDateString(),
                    'received_by'   => $adminId,
                    'notes'         => 'Initial stock batch',
                ]);

                InventoryTransaction::create([
                    'item_id'          => $item->id,
                    'batch_id'         => $batch->id,
                    'type'             => 'IN',
                    'quantity'         => $s['qty'],
                    'reason'           => 'Stock In',
                    'recorded_by'      => $adminId,
                    'transaction_date' => now()->toDateString(),
                    'notes'            => 'Initial stock',
                ]);

                if (!empty($s['low_stock_deduct'])) {
                    $deduct = $s['low_stock_deduct'];
                    $batch->increment('quantity_used', $deduct);
                    InventoryTransaction::create([
                        'item_id'          => $item->id,
                        'batch_id'         => $batch->id,
                        'type'             => 'OUT',
                        'quantity'         => $deduct,
                        'reason'           => 'Used in clinic',
                        'recorded_by'      => $adminId,
                        'transaction_date' => now()->toDateString(),
                        'notes'            => 'Wound dressing treatment',
                    ]);
                }
            } else {
                $updates = [];
                if (empty($batch->received_date)) {
                    $updates['received_date'] = now()->toDateString();
                }
                if (!empty($s['months']) && empty($batch->expiry_date)) {
                    $updates['expiry_date'] = $expiry;
                }
                if (!empty($updates)) {
                    $batch->update($updates);
                }
            }
        }

        // ── 3. EQUIPMENT ──────────────────────────────────────────────────────
        $equipment = [
            ['name' => 'BP Monitor', 'location' => 'Clinic Room 1'],
            ['name' => 'Digital Thermometer', 'location' => 'Clinic Room 1'],
            ['name' => 'Stethoscope', 'location' => 'Clinic Room 1'],
            ['name' => 'Weighing Scale', 'location' => 'Clinic Room 2'],
            ['name' => 'Wheelchair', 'location' => 'Hallway'],
            ['name' => 'Stretcher', 'location' => 'Clinic Room 2'],
            ['name' => 'Pulse Oximeter', 'location' => 'Clinic Room 1'],
        ];

        foreach ($equipment as $eq) {
            InventoryItem::firstOrCreate(
                ['name' => $eq['name']],
                [
                    'category'         => 'Equipment',
                    'unit'             => 'piece',
                    'reorder_level'    => 0,
                    'is_active'        => true,
                    'equipment_status' => 'Available',
                    'location'         => $eq['location'],
                ]
            );
        }
    }
}
