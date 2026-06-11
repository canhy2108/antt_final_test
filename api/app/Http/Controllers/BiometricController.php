<?php

namespace App\Http\Controllers;

use App\Models\BiometricCredential;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Device-bound biometric login (FIDO / WebAuthn-style).
 *
 * SECURITY MODEL
 * ----------------
 * The previous "match by most-recently-enrolled-face" + "match by closest
 * hold-time" design was a complete authentication bypass: any face scan
 * (or even a wall) signed the attacker into the most-recent victim's
 * account; any 1.5–4.5s screen press signed them into whoever held closest.
 *
 * The replacement here matches how Alipay / WeChat Pay / VietQR actually
 * do passwordless biometric login:
 *
 *   1. Enrolment requires a logged-in user AND the OS biometric prompt
 *      passing on the client. The client sends a stable device_fingerprint.
 *   2. Server creates a row in `biometric_credentials` keyed by
 *      (user_id, device_fingerprint, kind) and returns a one-time-issued
 *      32-byte random `bio_token`. We persist ONLY sha256(bio_token).
 *   3. The client stashes (credential_id + bio_token) inside iOS Keychain
 *      / Android Keystore behind a biometric-required ACL.
 *   4. Login: client passes OS biometric → reads the credential → POSTs
 *      (credential_id, bio_token, device_fingerprint). Server hashes the
 *      incoming token and compares with `hash_equals` (constant-time);
 *      matches the row's device_fingerprint; checks not revoked/expired;
 *      issues a fresh Sanctum token.
 *
 * Why this is secure:
 *   - The attacker cannot login without the device-bound bio_token.
 *   - Stealing the token from one device does not work elsewhere
 *     (device_fingerprint mismatch).
 *   - OS biometric is the real biometric check (Secure Enclave /
 *     StrongBox), not an in-app camera frame or hold-timer.
 *   - DB compromise leaks only hashes; credentials cannot be replayed.
 */
class BiometricController extends Controller
{
    private const TOKEN_BYTES = 32;          // 256-bit secret
    private const TOKEN_TTL_DAYS = 180;       // re-enroll every 6 months
    private const LOGIN_MAX_PER_MINUTE = 8;   // per (device, kind)
    private const ENROLL_MAX_PER_HOUR = 5;    // per user

    /** POST /api/biometric/enroll-face  (auth required) */
    public function enrollFace(Request $request)
    {
        return $this->enroll($request, 'face');
    }

    /** POST /api/biometric/enroll-fingerprint  (auth required) */
    public function enrollFingerprint(Request $request)
    {
        return $this->enroll($request, 'fingerprint');
    }

    /** POST /api/biometric/login-face  (public) */
    public function loginByFace(Request $request)
    {
        return $this->login($request, 'face');
    }

    /** POST /api/biometric/login-fingerprint  (public) */
    public function loginByFingerprint(Request $request)
    {
        return $this->login($request, 'fingerprint');
    }

    /** DELETE /api/biometric/credentials/{id}  (auth required) */
    public function revoke(Request $request, $id)
    {
        $cred = BiometricCredential::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();
        $cred->revoke();

        Log::channel('audit')->info('bio_credential_revoked', [
            'user_id' => $request->user()->id,
            'credential_id' => $id,
            'kind' => $cred->kind,
        ]);

        return response()->json(['ok' => true]);
    }

    /** GET /api/biometric/credentials  (auth required) */
    public function index(Request $request)
    {
        $creds = BiometricCredential::where('user_id', $request->user()->id)
            ->whereNull('revoked_at')
            ->orderByDesc('last_used_at')
            ->get(['id', 'kind', 'label', 'last_used_at', 'expires_at', 'created_at']);

        return response()->json(['credentials' => $creds]);
    }

    // -------------------------------------------------------------- helpers --

    private function enroll(Request $request, string $kind)
    {
        $user = $request->user();

        $rlKey = "bio_enroll_{$user->id}";
        if (RateLimiter::tooManyAttempts($rlKey, self::ENROLL_MAX_PER_HOUR)) {
            return response()->json([
                'message' => 'Bạn đã đăng ký sinh trắc quá nhiều lần — vui lòng thử lại sau 1 giờ.',
            ], 429);
        }
        RateLimiter::hit($rlKey, 3600);

        $v = $request->validate([
            'device_fingerprint' => 'required|string|min:8|max:128',
            'label' => 'nullable|string|max:100',
        ]);

        // Generate a 256-bit secret. Returned ONCE to the client; only the
        // hash is persisted. Stealing the row from the DB does not let
        // an attacker login as the user.
        $plain = bin2hex(random_bytes(self::TOKEN_BYTES));
        $hash = hash('sha256', $plain);

        $cred = BiometricCredential::updateOrCreate(
            [
                'user_id' => $user->id,
                'device_fingerprint' => $v['device_fingerprint'],
                'kind' => $kind,
            ],
            [
                'token_hash' => $hash,
                'label' => $v['label'] ?? null,
                'expires_at' => now()->addDays(self::TOKEN_TTL_DAYS),
                'revoked_at' => null,
                'last_used_at' => null,
            ],
        );

        // Mirror enrolment_at on the user row so the existing UI flags work.
        if ($kind === 'face') {
            $user->face_enrolled_at = now();
        } else {
            $user->fingerprint_enrolled_at = now();
        }
        $user->save();

        Log::channel('audit')->info("bio_{$kind}_enrolled", [
            'user_id' => $user->id,
            'credential_id' => $cred->id,
        ]);

        return response()->json([
            'message' => 'Đã đăng ký sinh trắc trên server',
            'credential_id' => $cred->id,
            // ONLY chance to read the plaintext — caller MUST stash it
            // behind a biometric-locked Keychain/Keystore entry.
            'bio_token' => $plain,
            'expires_at' => $cred->expires_at,
            'kind' => $kind,
        ]);
    }

    private function login(Request $request, string $kind)
    {
        // Two-axis rate limit: IP-wide + per device fingerprint, to throttle
        // both a single device burst and a botnet sweeping random device IDs.
        $ipKey = "bio_{$kind}_login_ip_" . $request->ip();
        if (RateLimiter::tooManyAttempts($ipKey, self::LOGIN_MAX_PER_MINUTE)) {
            return response()->json([
                'message' => 'Quá nhiều lần thử đăng nhập sinh trắc. Vui lòng đợi 1 phút.',
            ], 429);
        }
        RateLimiter::hit($ipKey, 60);

        $v = $request->validate([
            'credential_id' => 'required|integer',
            'bio_token' => 'required|string|min:32|max:256',
            'device_fingerprint' => 'required|string|min:8|max:128',
        ]);

        $deviceKey = "bio_{$kind}_login_dev_" . hash('sha256', $v['device_fingerprint']);
        if (RateLimiter::tooManyAttempts($deviceKey, self::LOGIN_MAX_PER_MINUTE)) {
            return response()->json([
                'message' => 'Thiết bị này đang bị tạm khoá sinh trắc. Vui lòng đợi 1 phút.',
            ], 429);
        }
        RateLimiter::hit($deviceKey, 60);

        // Resolve credential strictly by (id, kind, device_fingerprint). All
        // three must match — a stolen token from a different kind or a
        // different device cannot reach a different row.
        $cred = BiometricCredential::where('id', $v['credential_id'])
            ->where('kind', $kind)
            ->where('device_fingerprint', $v['device_fingerprint'])
            ->first();

        // Constant-time hash compare. Always compute the hash even if the
        // credential row is missing so the timing side-channel doesn't leak
        // "credential exists vs not".
        $candidateHash = hash('sha256', $v['bio_token']);
        $storedHash = $cred?->token_hash ?? str_repeat('0', 64);
        $hashOk = hash_equals($storedHash, $candidateHash);

        if (!$cred || !$hashOk || !$cred->isActive()) {
            Log::channel('audit')->warning("bio_{$kind}_login_failed", [
                'credential_id' => $v['credential_id'],
                'ip' => $request->ip(),
                'reason' => !$cred ? 'no_credential' : (!$hashOk ? 'hash_mismatch' : 'inactive'),
            ]);
            return response()->json([
                'message' => 'Sinh trắc không khớp với thiết bị này. Vui lòng đăng nhập bằng mật khẩu.',
            ], 401);
        }

        $user = User::find($cred->user_id);
        if (!$user) {
            // User was deleted but credential survived — fail closed.
            return response()->json([
                'message' => 'Tài khoản không còn tồn tại.',
            ], 401);
        }

        DB::transaction(function () use ($user, $cred) {
            $cred->recordUse();
            $user->login_count = (int) ($user->login_count ?? 0) + 1;
            $user->last_login_at = now();
            $user->save();
        });

        $tokenName = $request->header('X-Device-Id') ?? "bio_{$kind}_login";
        $token = $user->createToken($tokenName, ['*'], now()->addDays(30))->plainTextToken;

        Log::channel('audit')->info("bio_{$kind}_login_success", [
            'user_id' => $user->id,
            'credential_id' => $cred->id,
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'expires_in' => 2592000,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'matched_by' => $kind,
        ]);
    }
}
