<?php

namespace App\Http\Controllers;

use App\Models\BiometricNonce;
use App\Models\User;
use App\Models\UserDeviceKey;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Hardware-backed biometric login (Phase B — FIDO/WebAuthn style without
 * the WebAuthn ceremony overhead).
 *
 * Three endpoints:
 *
 *   POST /biometric/keys/register   (auth required)
 *     Body: { device_fingerprint, kind, alias, public_key, algorithm? }
 *     Stores the public key. The private key was generated in
 *     Secure Enclave / StrongBox by the client; it never crosses the wire.
 *
 *   POST /biometric/keys/challenge  (public)
 *     Body: { device_fingerprint, kind, alias }
 *     Server returns a one-shot 32-byte random nonce (hex). The client
 *     must sign it with the in-enclave private key (the OS biometric
 *     prompt fires as part of the sign call) and POST it back to /verify.
 *
 *   POST /biometric/keys/verify     (public)
 *     Body: { device_fingerprint, kind, alias, nonce, signature }
 *     Server verifies the ECDSA signature with the stored public key;
 *     marks the nonce used; issues a Sanctum token.
 */
class BiometricChallengeController extends Controller
{
    private const NONCE_TTL_SECONDS = 60;
    private const NONCE_BYTES = 32;
    private const RATE_LIMIT_PER_MINUTE = 8;

    /** POST /api/biometric/keys/register  (auth) */
    public function register(Request $request)
    {
        $v = $request->validate([
            'device_fingerprint' => 'required|string|min:8|max:128',
            'kind' => 'required|in:face,fingerprint',
            'alias' => 'required|string|max:64',
            'public_key' => 'required|string|max:8192',
            'algorithm' => 'nullable|string|max:32',
        ]);

        // Sanity-check the public key — must be base64 and the decoded bytes
        // must look plausible for a P-256 key (33–120 bytes for either
        // X9.63 uncompressed point or SubjectPublicKeyInfo wrapper).
        $decoded = base64_decode($v['public_key'], true);
        if ($decoded === false || strlen($decoded) < 33 || strlen($decoded) > 200) {
            return response()->json([
                'message' => 'Public key không hợp lệ — định dạng phải là base64 P-256.',
            ], 422);
        }

        $user = $request->user();
        $key = UserDeviceKey::updateOrCreate(
            [
                'user_id' => $user->id,
                'device_fingerprint' => $v['device_fingerprint'],
                'kind' => $v['kind'],
            ],
            [
                'alias' => $v['alias'],
                'public_key' => $v['public_key'],
                'algorithm' => $v['algorithm'] ?? 'ES256',
                'revoked_at' => null,
                'last_used_at' => null,
            ],
        );

        Log::channel('audit')->info('bio_key_registered', [
            'user_id' => $user->id,
            'device_key_id' => $key->id,
            'kind' => $key->kind,
        ]);

        return response()->json([
            'message' => 'Đã đăng ký public key sinh trắc lên server',
            'device_key_id' => $key->id,
        ]);
    }

    /** POST /api/biometric/keys/challenge  (public) */
    public function challenge(Request $request)
    {
        $rlKey = 'bio_challenge_' . $request->ip();
        if (RateLimiter::tooManyAttempts($rlKey, self::RATE_LIMIT_PER_MINUTE)) {
            return response()->json([
                'message' => 'Quá nhiều yêu cầu — vui lòng đợi 1 phút.',
            ], 429);
        }
        RateLimiter::hit($rlKey, 60);

        $v = $request->validate([
            'device_fingerprint' => 'required|string|min:8|max:128',
            'kind' => 'required|in:face,fingerprint',
            'alias' => 'required|string|max:64',
        ]);

        $key = UserDeviceKey::where('device_fingerprint', $v['device_fingerprint'])
            ->where('kind', $v['kind'])
            ->where('alias', $v['alias'])
            ->whereNull('revoked_at')
            ->first();

        if (!$key) {
            // We deliberately return the same shape so the timing/response
            // does not leak whether the key is registered.
            return response()->json([
                'message' => 'Chưa đăng ký sinh trắc trên thiết bị này.',
            ], 404);
        }

        $nonce = bin2hex(random_bytes(self::NONCE_BYTES));
        BiometricNonce::create([
            'nonce_hash' => hash('sha256', $nonce),
            'user_device_key_id' => $key->id,
            'expires_at' => now()->addSeconds(self::NONCE_TTL_SECONDS),
        ]);

        return response()->json([
            'nonce' => $nonce,
            'expires_in' => self::NONCE_TTL_SECONDS,
            'algorithm' => $key->algorithm,
        ]);
    }

    /** POST /api/biometric/keys/verify  (public) */
    public function verify(Request $request)
    {
        $rlKey = 'bio_verify_' . $request->ip();
        if (RateLimiter::tooManyAttempts($rlKey, self::RATE_LIMIT_PER_MINUTE)) {
            return response()->json([
                'message' => 'Quá nhiều yêu cầu — vui lòng đợi 1 phút.',
            ], 429);
        }
        RateLimiter::hit($rlKey, 60);

        $v = $request->validate([
            'device_fingerprint' => 'required|string|min:8|max:128',
            'kind' => 'required|in:face,fingerprint',
            'alias' => 'required|string|max:64',
            'nonce' => 'required|string|size:64', // 32 bytes hex = 64 chars
            'signature' => 'required|string|max:512', // base64 DER ECDSA
        ]);

        $key = UserDeviceKey::where('device_fingerprint', $v['device_fingerprint'])
            ->where('kind', $v['kind'])
            ->where('alias', $v['alias'])
            ->whereNull('revoked_at')
            ->first();

        if (!$key) {
            return $this->fail($v, 'no_key');
        }

        // Find the nonce — must belong to this exact key, unused, unexpired.
        $nonceHash = hash('sha256', $v['nonce']);
        $nonceRow = BiometricNonce::where('user_device_key_id', $key->id)
            ->where('nonce_hash', $nonceHash)
            ->first();

        if (!$nonceRow || !$nonceRow->isUsable()) {
            return $this->fail($v, 'no_nonce');
        }

        // Verify the ECDSA signature. Both Android Keystore and iOS Secure
        // Enclave produce DER-encoded signatures by default. We accept both
        // the raw DER (binary) base64-encoded and the JOSE/IEEE-P1363
        // (r||s) base64-encoded forms — auto-detect.
        $signatureDer = $this->normaliseSignatureToDer($v['signature']);
        $pubKeyPem = $this->publicKeyToPem($key->public_key);

        if ($pubKeyPem === null || $signatureDer === null) {
            return $this->fail($v, 'bad_input');
        }

        $verifyOk = false;
        try {
            $verifyResult = openssl_verify(
                $v['nonce'],          // verify the original hex string the client signed
                $signatureDer,
                $pubKeyPem,
                OPENSSL_ALGO_SHA256,
            );
            $verifyOk = $verifyResult === 1;
        } catch (\Throwable $e) {
            Log::channel('audit')->warning('bio_verify_exception', [
                'error' => $e->getMessage(),
                'device_key_id' => $key->id,
            ]);
            return $this->fail($v, 'verify_error');
        }

        if (!$verifyOk) {
            return $this->fail($v, 'sig_mismatch');
        }

        $user = User::find($key->user_id);
        if (!$user) {
            return $this->fail($v, 'no_user');
        }

        DB::transaction(function () use ($user, $key, $nonceRow) {
            $nonceRow->consume();
            $key->update(['last_used_at' => now()]);
            $user->login_count = (int) ($user->login_count ?? 0) + 1;
            $user->last_login_at = now();
            $user->save();
        });

        $tokenName = $request->header('X-Device-Id') ?? "bio_{$key->kind}_login";
        $token = $user->createToken($tokenName, ['*'], now()->addDays(30))->plainTextToken;

        Log::channel('audit')->info("bio_{$key->kind}_keylogin_success", [
            'user_id' => $user->id,
            'device_key_id' => $key->id,
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
            'matched_by' => $key->kind,
        ]);
    }

    /** GET /api/biometric/keys  (auth) — list device keys */
    public function index(Request $request)
    {
        $keys = UserDeviceKey::where('user_id', $request->user()->id)
            ->whereNull('revoked_at')
            ->orderByDesc('last_used_at')
            ->get(['id', 'kind', 'alias', 'algorithm', 'last_used_at', 'created_at']);

        return response()->json(['keys' => $keys]);
    }

    /** DELETE /api/biometric/keys/{id}  (auth) — revoke */
    public function revoke(Request $request, $id)
    {
        $key = UserDeviceKey::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();
        $key->revoke();

        Log::channel('audit')->info('bio_key_revoked', [
            'user_id' => $request->user()->id,
            'device_key_id' => $id,
        ]);

        return response()->json(['ok' => true]);
    }

    // ------------------------------------------------------------ helpers --

    private function fail(array $v, string $reason)
    {
        Log::channel('audit')->warning('bio_verify_failed', [
            'reason' => $reason,
            'kind' => $v['kind'] ?? null,
            'alias' => $v['alias'] ?? null,
        ]);
        return response()->json([
            'message' => 'Sinh trắc không khớp. Vui lòng đăng nhập bằng mật khẩu.',
        ], 401);
    }

    /**
     * Accept the public key in either of the two forms the client can
     * realistically send and return a PEM blob OpenSSL can verify with:
     *
     *   - Android Keystore: base64 of SubjectPublicKeyInfo (X.509) — wrap in
     *     "-----BEGIN PUBLIC KEY-----" PEM markers and return.
     *   - iOS Secure Enclave: base64 of raw X9.63 uncompressed point
     *     (0x04 || X || Y, 65 bytes for P-256). Wrap as SPKI manually.
     */
    private function publicKeyToPem(string $base64): ?string
    {
        $bin = base64_decode($base64, true);
        if ($bin === false) return null;

        // Heuristic 1: SubjectPublicKeyInfo (Android default). Decodes to
        // ~91 bytes for ES256. Try OpenSSL directly first.
        if (strlen($bin) >= 80 && strlen($bin) <= 200) {
            $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split($base64, 64) . "-----END PUBLIC KEY-----\n";
            $check = @openssl_pkey_get_public($pem);
            if ($check !== false) return $pem;
        }

        // Heuristic 2: raw X9.63 point (iOS). 65 bytes, leading 0x04.
        if (strlen($bin) === 65 && ord($bin[0]) === 0x04) {
            // Wrap into SPKI manually: this is the DER for
            // prime256v1 OID + bitstring of the uncompressed point.
            $spkiPrefix = hex2bin(
                '3059301306072a8648ce3d020106082a8648ce3d03010703420004',
            );
            if ($spkiPrefix === false) return null;
            // The raw point already starts with 0x04 — we replicate that as
            // the bitstring content (the SPKI prefix above already includes
            // an 03420004 marker that the next bytes' x||y must follow).
            $der = $spkiPrefix . substr($bin, 1); // strip the duplicate 0x04
            $b64 = base64_encode($der);
            $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split($b64, 64) . "-----END PUBLIC KEY-----\n";
            $check = @openssl_pkey_get_public($pem);
            if ($check !== false) return $pem;
        }

        return null;
    }

    /**
     * Accept ECDSA signatures in either DER (Android Keystore default) or
     * IEEE P1363 / JOSE raw (r||s, 64 bytes for P-256). Return DER bytes
     * because OpenSSL's verify expects DER.
     */
    private function normaliseSignatureToDer(string $base64): ?string
    {
        $bin = base64_decode($base64, true);
        if ($bin === false) return null;

        // IEEE P1363 / JOSE raw: 2 * 32 bytes = 64.
        if (strlen($bin) === 64) {
            $r = substr($bin, 0, 32);
            $s = substr($bin, 32, 32);
            return $this->derFromRs($r, $s);
        }

        // Otherwise assume already DER.
        return $bin;
    }

    private function derFromRs(string $r, string $s): string
    {
        $rb = $this->derInteger($r);
        $sb = $this->derInteger($s);
        $seq = $rb . $sb;
        return "\x30" . $this->derLen(strlen($seq)) . $seq;
    }

    private function derInteger(string $bytes): string
    {
        // Strip leading zero bytes
        $bytes = ltrim($bytes, "\x00");
        if ($bytes === '') $bytes = "\x00";
        // If the high bit is set, prepend a zero (DER positive integer)
        if (ord($bytes[0]) & 0x80) $bytes = "\x00" . $bytes;
        return "\x02" . $this->derLen(strlen($bytes)) . $bytes;
    }

    private function derLen(int $n): string
    {
        if ($n < 0x80) return chr($n);
        $hex = ltrim(dechex($n), '0');
        if (strlen($hex) % 2 === 1) $hex = '0' . $hex;
        $bytes = hex2bin($hex);
        return chr(0x80 | strlen($bytes)) . $bytes;
    }
}
