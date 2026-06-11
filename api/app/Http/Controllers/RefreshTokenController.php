<?php

namespace App\Http\Controllers;

use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class RefreshTokenController extends Controller
{
    // Refresh TTL in days for newly issued refresh tokens
    private const REFRESH_TTL_DAYS = 30;

    /** POST /api/auth/refresh */
    public function refresh(Request $request)
    {
        $v = $request->validate([
            'refresh_token' => 'required|string',
            'device_id' => 'nullable|string',
        ]);

        $provided = $v['refresh_token'];
        $hash = hash('sha256', $provided);

        $rt = RefreshToken::where('token_hash', $hash)->first();

        if (!$rt) {
            // Reuse detection: token not found — possible token replay or tampering.
            Log::warning('refresh_token_not_found', ['device_id' => $v['device_id'] ?? null]);
            return response()->json(['message' => 'Invalid refresh token'], 401);
        }

        if ($rt->is_revoked) {
            // Reuse detected — revoke all user's sessions and tokens
            $this->revokeAllForUser($rt->user_id);
            Log::warning('refresh_token_reuse_detected', ['user_id' => $rt->user_id]);
            return response()->json(['message' => 'Refresh token reuse detected'], 401);
        }

        if ($rt->expires_at && $rt->expires_at->isPast()) {
            return response()->json(['message' => 'Refresh token expired'], 401);
        }

        // Rotate: create new refresh token and revoke old
        $newPlain = bin2hex(random_bytes(32));
        $newHash = hash('sha256', $newPlain);

        $new = RefreshToken::create([
            'jti' => (string) Str::uuid(),
            'user_id' => $rt->user_id,
            'device_id' => $v['device_id'] ?? $rt->device_id,
            'token_hash' => $newHash,
            'is_revoked' => false,
            'expires_at' => now()->addDays(self::REFRESH_TTL_DAYS),
            'replaced_by' => null,
        ]);

        $rt->is_revoked = true;
        $rt->replaced_by = $new->id;
        $rt->save();

        // Issue a new access token (Sanctum Personal Access Token)
        $user = User::find($rt->user_id);
        if (!$user) return response()->json(['message' => 'User not found'], 404);

        $tokenName = $request->header('X-Device-Id') ?? 'refresh_rotation';
        $accessToken = $user->createToken($tokenName, ['*'], now()->addHours(1))->plainTextToken;

        return response()->json([
            'access_token' => $accessToken,
            'refresh_token' => $newPlain,
            'expires_in' => 3600,
        ]);
    }

    private function revokeAllForUser($userId)
    {
        // Revoke Sanctum tokens and mark refresh_tokens revoked
        $user = User::find($userId);
        if ($user) {
            $user->tokens()->delete();
            RefreshToken::where('user_id', $userId)->update(['is_revoked' => true]);
        }
    }
}
