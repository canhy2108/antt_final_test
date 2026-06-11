<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\UserSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DeviceController extends Controller
{
    /** List the user's devices + active sessions. */
    public function index(Request $request)
    {
        $devices = Device::where('user_id', $request->user()->id)
            ->orderByDesc('last_seen_at')
            ->get();

        $sessions = UserSession::where('user_id', $request->user()->id)
            ->whereNull('revoked_at')
            ->orderByDesc('last_active_at')
            ->limit(50)
            ->get();

        return response()->json([
            'devices' => $devices,
            'active_sessions' => $sessions,
            'session_count' => $sessions->count(),
            'current_token_id' => $request->user()->currentAccessToken()?->id,
        ]);
    }

    /**
     * Register/refresh a device record. Called by the client on app launch
     * with its fingerprint + platform info.
     */
    public function register(Request $request)
    {
        $v = $request->validate([
            'device_fingerprint' => 'required|string|max:128',
            'name' => 'nullable|string|max:100',
            'platform' => 'nullable|in:ios,android,web',
            'os_version' => 'nullable|string|max:50',
            'app_version' => 'nullable|string|max:50',
        ]);

        $now = now();
        $device = Device::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'device_fingerprint' => $v['device_fingerprint'],
            ],
            [
                'name' => $v['name'] ?? null,
                'platform' => $v['platform'] ?? null,
                'os_version' => $v['os_version'] ?? null,
                'app_version' => $v['app_version'] ?? null,
                'last_ip' => $request->ip(),
                'last_seen_at' => $now,
                'first_seen_at' => fn ($d) => $d->first_seen_at ?? $now,
            ],
        );

        return response()->json($device);
    }

    /** Mark a device as trusted (skips step-up MFA on subsequent logins). */
    public function trust(Request $request, $id)
    {
        $device = Device::findOrFail($id);
        $this->ownerCheck($device, $request);
        $device->trust();
        return response()->json($device);
    }

    /** Revoke a device + all its live sessions. */
    public function revoke(Request $request, $id)
    {
        $device = Device::findOrFail($id);
        $this->ownerCheck($device, $request);

        $device->revoke();

        Log::channel('audit')->info('device_revoked', [
            'user_id' => $request->user()->id,
            'device_id' => $id,
        ]);

        return response()->json(['ok' => true]);
    }

    /**
     * "Đăng xuất tất cả thiết bị khác" — keeps current token alive but
     * nukes every other Sanctum token + session row.
     */
    public function revokeOtherSessions(Request $request)
    {
        $user = $request->user();
        $current = $user->currentAccessToken();

        // Revoke all session rows except the current one
        UserSession::where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->where('personal_access_token_id', '!=', $current?->id)
            ->update(['revoked_at' => now()]);

        // Drop all Sanctum tokens except the current
        $user->tokens()
            ->where('id', '!=', $current?->id)
            ->delete();

        Log::channel('audit')->info('sessions_revoked_others', ['user_id' => $user->id]);

        return response()->json(['ok' => true]);
    }

    private function ownerCheck(Device $device, Request $request): void
    {
        if ($device->user_id !== $request->user()->id) abort(403);
    }
}
