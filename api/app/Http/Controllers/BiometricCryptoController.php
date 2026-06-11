<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserDevice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class BiometricCryptoController extends Controller
{
    // Challenge TTL seconds
    private const CHALLENGE_TTL = 60;

    /**
     * POST /api/biometric/challenge
     * Body: { email, device_id }
     * Returns: { challenge }
     */
    public function challenge(Request $request)
    {
        $v = $request->validate([
            'email' => 'required|email',
            'device_id' => 'required|string|min:4|max:128',
        ]);

        $user = User::where('email', $v['email'])->first();
        if (!$user) return response()->json(['message' => 'User not found'], 404);

        $device = UserDevice::where('user_id', $user->id)
            ->where('device_id', $v['device_id'])
            ->whereNull('revoked_at')
            ->first();

        if (!$device) return response()->json(['message' => 'Device not registered'], 404);

        $raw = random_bytes(32);
        $hex = bin2hex($raw);
        Cache::put('bio_challenge_' . $hex, ['user_id' => $user->id, 'device_id' => $v['device_id']], self::CHALLENGE_TTL);

        return response()->json(['challenge' => base64_encode($raw), 'ttl' => self::CHALLENGE_TTL]);
    }

    /**
     * POST /api/biometric/verify
     * Body: { email, device_id, challenge, signature }
     */
    public function verify(Request $request)
    {
        $v = $request->validate([
            'email' => 'required|email',
            'device_id' => 'required|string|min:4|max:128',
            'challenge' => 'required|string',
            'signature' => 'required|string',
        ]);

        $user = User::where('email', $v['email'])->first();
        if (!$user) return response()->json(['message' => 'User not found'], 404);

        $device = UserDevice::where('user_id', $user->id)
            ->where('device_id', $v['device_id'])
            ->whereNull('revoked_at')
            ->first();
        if (!$device) return response()->json(['message' => 'Device not registered'], 404);

        $decodedChallenge = base64_decode($v['challenge']);
        if ($decodedChallenge === false) return response()->json(['message' => 'Invalid challenge'], 400);

        $hex = bin2hex($decodedChallenge);
        $cached = Cache::pull('bio_challenge_' . $hex);
        if (!$cached) return response()->json(['message' => 'Challenge expired or not found'], 400);

        // verify signature using stored public key
        $pub = $device->public_key;
        // ensure PEM header if stored as base64 raw key
        if (strpos($pub, '-----BEGIN') === false) {
            // try to wrap as PEM (assuming raw X.509 SubjectPublicKeyInfo DER)
            $pub = "-----BEGIN PUBLIC KEY-----\n" . chunk_split($pub, 64, "\n") . "-----END PUBLIC KEY-----\n";
        }

        $sig = base64_decode($v['signature']);
        if ($sig === false) return response()->json(['message' => 'Invalid signature encoding'], 400);

        $ok = openssl_verify($decodedChallenge, $sig, $pub, OPENSSL_ALGO_SHA256) === 1;

        if (!$ok) {
            Log::channel('audit')->warning('bio_verify_failed', ['user_id' => $user->id, 'device_id' => $v['device_id']]);
            return response()->json(['message' => 'Invalid signature'], 401);
        }

        // success — issue token (short-lived access token). Using Sanctum plainTextToken like other flows.
        $tokenName = $request->header('X-Device-Id') ?? "biometric_crypto_login";
        $token = $user->createToken($tokenName, ['*'], now()->addDays(30))->plainTextToken;

        $device->last_used_at = now();
        $device->save();

        Log::channel('audit')->info('bio_verify_success', ['user_id' => $user->id, 'device_id' => $v['device_id']]);

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'expires_in' => 2592000,
            'user' => ['id' => $user->id, 'email' => $user->email],
        ]);
    }
}
