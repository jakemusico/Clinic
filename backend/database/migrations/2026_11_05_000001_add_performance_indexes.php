<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes for the columns the dashboards, the header counters and the list pages filter, sort
 * and group on. Before this, clinic_records.visit_date, appointments.scheduled_at,
 * notifications.is_read, inventory_transactions.type and similar columns had no index, so every
 * dashboard load scanned whole tables.
 *
 * Safe to run on a database that already has some of them: each index is only created when the
 * table and columns exist and no index with that name is there yet.
 */
return new class extends Migration
{
    /** table => [index name => columns] */
    private function indexes(): array
    {
        return [
            'clinic_records' => [
                'idx_clinic_records_visit_date'    => ['visit_date'],
                'idx_clinic_records_created_at'    => ['created_at'],
                'idx_clinic_records_patient_visit' => ['patient_id', 'visit_date'],
            ],
            'dental_consultations' => [
                'idx_dental_consultations_date'          => ['consultation_date'],
                'idx_dental_consultations_created_at'    => ['created_at'],
                'idx_dental_consultations_patient_date'  => ['patient_id', 'consultation_date'],
            ],
            'appointments' => [
                'idx_appointments_scheduled_at'      => ['scheduled_at'],
                'idx_appointments_type_scheduled'    => ['appointment_type', 'scheduled_at'],
                'idx_appointments_type_unread'       => ['appointment_type', 'is_read'],
                'idx_appointments_patient_scheduled' => ['patient_id', 'scheduled_at'],
                'idx_appointments_patient_status'    => ['patient_id', 'status'],
            ],
            'notifications' => [
                'idx_notifications_user_read_created' => ['user_id', 'is_read', 'created_at'],
            ],
            'inventory_transactions' => [
                'idx_inventory_tx_item_type' => ['item_id', 'type'],
                'idx_inventory_tx_date'      => ['transaction_date'],
            ],
            'inventory_items' => [
                'idx_inventory_items_category_active' => ['category', 'is_active'],
            ],
            'inventory_batches' => [
                'idx_inventory_batches_expiry' => ['expiry_date'],
            ],
            'messages' => [
                'idx_messages_conversation_read' => ['conversation_id', 'read_at'],
            ],
            'conversations' => [
                'idx_conversations_status_created' => ['status', 'created_at'],
            ],
            'users' => [
                'idx_users_role' => ['role'],
            ],
            'announcements' => [
                'idx_announcements_audience_created' => ['audience', 'created_at'],
            ],
            'calendar_events' => [
                'idx_calendar_events_start' => ['start_date'],
            ],
        ];
    }

    public function up(): void
    {
        foreach ($this->indexes() as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            foreach ($indexes as $name => $columns) {
                if (! Schema::hasColumns($table, $columns) || Schema::hasIndex($table, $name)) {
                    continue;
                }
                Schema::table($table, fn (Blueprint $t) => $t->index($columns, $name));
            }
        }
    }

    public function down(): void
    {
        foreach ($this->indexes() as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            foreach (array_keys($indexes) as $name) {
                if (Schema::hasIndex($table, $name)) {
                    Schema::table($table, fn (Blueprint $t) => $t->dropIndex($name));
                }
            }
        }
    }
};
