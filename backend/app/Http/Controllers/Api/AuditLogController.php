<?php

namespace App\Http\Controllers\Api;

use App\Support\Paging;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * GET /api/admin/audit-logs
     * Retrieve audit logs with filters (Admin only).
     */
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::with(['user']);

        // Search actor name/email, action type, ip or model
        if ($request->has('search') && $request->search != '') {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('action', 'like', "%{$search}%")
                  ->orWhere('ip_address', 'like', "%{$search}%")
                  ->orWhere('model_type', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($qu) use ($search) {
                      $qu->where('name', 'like', "%{$search}%")
                        ->orWhere('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                  });
            });
        }

        // Action filter
        if ($request->has('action') && $request->action != 'all') {
            $query->where('action', $request->action);
        }

        // Specific actor filter
        if ($request->has('user_id') && $request->user_id != 'all') {
            $query->where('user_id', $request->user_id);
        }

        // Date range filters
        if ($request->has('date_from') && $request->date_from != '') {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->has('date_to') && $request->date_to != '') {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $perPage = Paging::perPage($request);
        $logs = $query->orderBy('created_at', 'desc')->paginate($perPage);

        // Get list of distinct actions for filter dropdown
        $actions = AuditLog::distinct()->pluck('action');

        // Get list of distinct users who have performed actions
        $users = User::whereHas('auditLogs')->orderBy('name')->get(['id', 'name', 'email', 'role_id']);

        return response()->json([
            'logs'         => $logs,
            'data'         => $logs->items(),
            'current_page' => $logs->currentPage(),
            'last_page'    => $logs->lastPage(),
            'per_page'     => $logs->perPage(),
            'total'        => $logs->total(),
            'actions'      => $actions,
            'users'        => $users,
        ]);
    }
}
