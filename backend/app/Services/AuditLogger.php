<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Log;
use Throwable;

class AuditLogger
{
    /**
     * Log an action to the audit logs.
     *
     * Non-blocking: If logging fails for any reason, the error is written to
     * the Laravel application log and the caller continues execution uninterrupted.
     *
     * Includes a 3-second deduplication window: if an identical entry
     * (same user, action, model_type, model_id) was already written in
     * the last 3 seconds, the call is silently skipped to prevent double
     * entries from React StrictMode double-invocation or accidental
     * double-fetch.
     *
     * @param string $action e.g. 'login', 'logout', 'user_created', 'role_changed', 'record_accessed', 'record_created', 'record_updated', 'appointment_created', 'appointment_rescheduled', 'appointment_status_changed'
     * @param string|null $modelType
     * @param int|null $modelId
     * @param array|null $oldValues
     * @param array|null $newValues
     */
    public static function log(string $action, ?string $modelType = null, ?int $modelId = null, ?array $oldValues = null, ?array $newValues = null): void
    {
        try {
            $request = request();
            $user    = $request?->user();

            // Dedup: skip if an identical log was written within the last 3 seconds
            $duplicate = AuditLog::where('user_id', $user?->id)
                ->where('action', $action)
                ->where('model_type', $modelType)
                ->where('model_id', $modelId)
                ->where('created_at', '>=', now()->subSeconds(3))
                ->exists();

            if ($duplicate) {
                return;
            }

            AuditLog::create([
                'user_id'    => $user?->id,
                'action'     => $action,
                'model_type' => $modelType,
                'model_id'   => $modelId,
                'old_values' => $oldValues,
                'new_values' => $newValues,
                'ip_address' => $request?->ip(),
                'user_agent' => $request?->userAgent(),
            ]);
        } catch (Throwable $e) {
            Log::error("AuditLogger failed to record action '{$action}': " . $e->getMessage(), [
                'action'     => $action,
                'model_type' => $modelType,
                'model_id'   => $modelId,
                'exception'  => $e,
            ]);
        }
    }
}
