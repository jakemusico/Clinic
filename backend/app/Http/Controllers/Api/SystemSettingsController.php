<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Support\CacheVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class SystemSettingsController extends Controller
{
    /**
     * GET /api/settings/{key}
     * Public – used by Register page to fetch terms & privacy text.
     */
    public function show(string $key): JsonResponse
    {
        // Reference data (clinic info, terms ...): a found value is cached 5 minutes; saving any setting starts a
        // new version. A missing key (defaults / 404) is never cached.
        $value = Cache::remember(CacheVersion::key('settings', 'value', $key), 300, function () use ($key) {
            return SystemSetting::getValue($key);
        });
        if ($value === null) {
            if ($key === 'chat_enabled') {
                return response()->json(['key' => 'chat_enabled', 'value' => '1']);
            }
            if ($key === 'chat_offline_message') {
                return response()->json(['key' => 'chat_offline_message', 'value' => 'Currently offline. Your message will be answered during clinic hours.']);
            }
            if ($key === 'chat_auto_resolve_days') {
                return response()->json(['key' => 'chat_auto_resolve_days', 'value' => '7']);
            }
            if ($key === 'clinic_info') {
                $default = [
                    'schedule' => [
                        ['day' => 'Monday',    'is_open' => true,  'open_time' => '08:00', 'close_time' => '17:00'],
                        ['day' => 'Tuesday',   'is_open' => true,  'open_time' => '08:00', 'close_time' => '17:00'],
                        ['day' => 'Wednesday', 'is_open' => true,  'open_time' => '08:00', 'close_time' => '17:00'],
                        ['day' => 'Thursday',  'is_open' => true,  'open_time' => '08:00', 'close_time' => '17:00'],
                        ['day' => 'Friday',    'is_open' => true,  'open_time' => '08:00', 'close_time' => '17:00'],
                        ['day' => 'Saturday',  'is_open' => true,  'open_time' => '08:00', 'close_time' => '12:00'],
                        ['day' => 'Sunday',    'is_open' => false, 'open_time' => '08:00', 'close_time' => '17:00'],
                    ],
                    'schedule_note' => 'Emergency on-call on weekends',
                    'location_name' => 'Fr. Saturnino Urios University',
                    'location_address' => 'Ground Floor, Administration & Student Welfare Wing, San Francisco St., Butuan City, 8600',
                    'location_landmark' => 'Beside Guidance Center & Student Affairs Office',
                    'contact_trunkline' => '(085) 342-1830 loc. 124',
                    'contact_mobile' => '0917-123-4567',
                    'contact_email' => 'clinic@urios.edu.ph',
                ];
                $json = json_encode($default);
                SystemSetting::setValue('clinic_info', $json);
                return response()->json(['key' => 'clinic_info', 'value' => $json]);
            }
            return response()->json(['message' => 'Setting not found.'], 404);
        }
        return response()->json(['key' => $key, 'value' => $value]);
    }

    /**
     * PUT /api/admin/settings/{key}
     * Admin only – update any setting value.
     */
    public function update(Request $request, string $key): JsonResponse
    {
        if ($key === 'chat_auto_resolve_days') {
            $request->validate([
                'value' => ['required', 'integer', 'min:1', 'max:30'],
            ]);
        } elseif ($key === 'chat_offline_message') {
            $request->validate([
                'value' => ['required', 'string', 'max:500'],
            ]);
        } else {
            $request->validate([
                'value' => ['nullable', 'string'],
            ]);
        }

        $oldValue = SystemSetting::getValue($key);
        $newValue = $request->input('value') !== null ? (string) $request->input('value') : null;
        SystemSetting::setValue($key, $newValue);

        \App\Services\AuditLogger::log(
            'system_setting_updated',
            SystemSetting::class,
            null,
            ['key' => $key, 'value' => $oldValue],
            ['key' => $key, 'value' => $newValue]
        );

        return response()->json([
            'message' => 'Setting updated successfully.',
            'key'     => $key,
            'value'   => $newValue,
        ]);
    }
}
