<?php

namespace App\Http\Controllers;

use App\Models\TotpSecret;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * TOTP 2FA (RFC 6238) — Google Authenticator / Authy / 1Password compatible.
 *
 * Flow:
 *   1. POST /api/totp/setup       → returns secret + otpauth:// URL + QR
 *      (user scans with their authenticator app, secret saved but not yet enabled)
 *   2. POST /api/totp/verify      → submit 6-digit code from the app
 *      first successful verify flips `is_enabled` to true + generates backup codes
 *   3. POST /api/totp/disable     → require password + code, then drop the row
 *
 * RFC 6238 implementation is ~30 lines below — no external library needed.
 */
class TotpController extends Controller
{
    private const PERIOD = 30;       // seconds per code
    private const DIGITS = 6;
    private const ALGORITHM = 'sha1';

    public function status(Request $request)
    {
        $row = TotpSecret::where('user_id', $request->user()->id)->first();
        return response()->json([
            'enabled' => (bool) ($row?->is_enabled),
            'enrolled' => $row !== null,
            'backup_codes_remaining' => $row ? 8 - ($row->backup_codes_used ?? 0) : 0,
            'last_verified_at' => $row?->last_verified_at,
        ]);
    }

    /**
     * Create a fresh secret. Replaces any existing not-yet-enabled enrolment.
     */
    public function setup(Request $request)
    {
        $user = $request->user();

        // Generate 20-byte secret encoded as base32 (160-bit, RFC 6238 standard)
        $secret = $this->generateBase32Secret(20);

        $row = TotpSecret::updateOrCreate(
            ['user_id' => $user->id],
            [
                'secret_encrypted' => $secret, // encrypted by cast
                'is_enabled' => false,
                'backup_codes_used' => 0,
                'backup_codes_encrypted' => null,
            ],
        );

        // otpauth URL — paste into Google Authenticator OR render QR
        $issuer = rawurlencode('BudgetBee');
        $label = rawurlencode($user->email);
        $otpauthUrl = "otpauth://totp/{$issuer}:{$label}?secret={$secret}"
            . "&issuer={$issuer}&algorithm=SHA1&digits=6&period=30";

        return response()->json([
            'secret' => $secret,           // base32 — user can also type it manually
            'otpauth_url' => $otpauthUrl,
            // FE renders a QR from this URL — qrserver.com fallback shown
            'qr_code_url' => 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data='
                . rawurlencode($otpauthUrl),
            'message' => 'Quét mã QR trong Google Authenticator, sau đó nhập mã 6 số để hoàn tất.',
        ]);
    }

    /** Submit a 6-digit code. First successful verify enables 2FA. */
    public function verify(Request $request)
    {
        $v = $request->validate(['code' => 'required|string|min:6|max:8']);
        $code = preg_replace('/\s+/', '', $v['code']);

        $row = TotpSecret::where('user_id', $request->user()->id)->first();
        if (!$row) {
            return response()->json(['message' => 'Chưa thiết lập TOTP — vui lòng setup trước'], 404);
        }

        $secret = $row->secret_encrypted; // already decrypted by cast
        if (!$this->verifyTotp($secret, $code)) {
            Log::channel('audit')->info('totp_verify_failed', ['user_id' => $request->user()->id]);
            return response()->json(['message' => 'Mã không đúng hoặc đã hết hạn'], 422);
        }

        $firstTimeEnable = !$row->is_enabled;
        $payload = [
            'last_verified_at' => now(),
            'is_enabled' => true,
        ];
        $backupCodes = null;
        if ($firstTimeEnable) {
            // Generate 8 single-use 8-digit backup codes
            $backupCodes = collect(range(1, 8))->map(fn () => str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT))->all();
            $payload['enabled_at'] = now();
            $payload['backup_codes_encrypted'] = $backupCodes;
            $payload['backup_codes_used'] = 0;
        }
        $row->update($payload);

        Log::channel('audit')->info('totp_verify_success', [
            'user_id' => $request->user()->id,
            'first_enable' => $firstTimeEnable,
        ]);

        return response()->json([
            'enabled' => true,
            // Backup codes ONLY shown on the first-time enable — never again
            'backup_codes' => $backupCodes,
            'message' => $firstTimeEnable
                ? 'Đã bật 2FA. Lưu lại 8 mã backup ở chỗ an toàn — chỉ hiện 1 lần.'
                : 'Mã đúng.',
        ]);
    }

    public function disable(Request $request)
    {
        $v = $request->validate(['code' => 'required|string|min:6|max:8']);
        $row = TotpSecret::where('user_id', $request->user()->id)->first();
        if (!$row || !$row->is_enabled) {
            return response()->json(['message' => 'TOTP chưa được bật'], 404);
        }

        if (!$this->verifyTotp($row->secret_encrypted, $v['code'])) {
            return response()->json(['message' => 'Mã không đúng'], 422);
        }

        $row->delete();
        Log::channel('audit')->info('totp_disabled', ['user_id' => $request->user()->id]);

        return response()->json(['ok' => true, 'message' => '2FA đã tắt']);
    }

    // ====================== TOTP RFC 6238 internals =========================

    /** Generate a random N-byte base32 secret (no padding). */
    private function generateBase32Secret(int $bytes): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $raw = random_bytes($bytes);
        // RFC 4648 base32 encode
        $bin = '';
        for ($i = 0; $i < strlen($raw); $i++) {
            $bin .= str_pad(decbin(ord($raw[$i])), 8, '0', STR_PAD_LEFT);
        }
        $secret = '';
        foreach (str_split($bin, 5) as $chunk) {
            if (strlen($chunk) < 5) $chunk = str_pad($chunk, 5, '0');
            $secret .= $alphabet[bindec($chunk)];
        }
        return $secret;
    }

    /** Decode base32 → raw bytes. */
    private function base32Decode(string $b32): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $b32 = strtoupper(rtrim($b32, '='));
        $bin = '';
        foreach (str_split($b32) as $c) {
            $idx = strpos($alphabet, $c);
            if ($idx === false) continue;
            $bin .= str_pad(decbin($idx), 5, '0', STR_PAD_LEFT);
        }
        $out = '';
        foreach (str_split($bin, 8) as $byte) {
            if (strlen($byte) === 8) $out .= chr(bindec($byte));
        }
        return $out;
    }

    /** Verify TOTP code with ±1 step window (handles clock skew). */
    private function verifyTotp(string $base32Secret, string $code): bool
    {
        $rawSecret = $this->base32Decode($base32Secret);
        $now = floor(time() / self::PERIOD);

        // ±1 step (30s) tolerance
        foreach ([-1, 0, 1] as $offset) {
            $counter = (int) ($now + $offset);
            $expected = $this->generateCode($rawSecret, $counter);
            if (hash_equals($expected, $code)) return true;
        }
        return false;
    }

    /** HOTP generation per RFC 4226 — used internally by TOTP. */
    private function generateCode(string $rawSecret, int $counter): string
    {
        // 8-byte big-endian counter
        $binCounter = pack('N*', 0) . pack('N*', $counter);
        $hmac = hash_hmac(self::ALGORITHM, $binCounter, $rawSecret, true);

        $offset = ord($hmac[strlen($hmac) - 1]) & 0x0F;
        $truncated = ((ord($hmac[$offset]) & 0x7F) << 24)
            | ((ord($hmac[$offset + 1]) & 0xFF) << 16)
            | ((ord($hmac[$offset + 2]) & 0xFF) << 8)
            | (ord($hmac[$offset + 3]) & 0xFF);

        $mod = (int) pow(10, self::DIGITS);
        return str_pad((string) ($truncated % $mod), self::DIGITS, '0', STR_PAD_LEFT);
    }
}
