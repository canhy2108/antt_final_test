<?php

namespace App\Services;

use App\Mail\SendOtpMail;
use App\Models\Otp;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class OtpService
{
    public const PURPOSE_REGISTER = 'register';
    public const PURPOSE_RESET_PASSWORD = 'reset_password';
    public const PURPOSE_SENSITIVE = 'sensitive';
    public const PURPOSE_CHANGE_EMAIL = 'change_email';
    public const PURPOSE_CHANGE_PIN = 'change_pin';

    /** Per-purpose expiry override. Falls back to otp.expire_minutes. */
    private static function expireMinutesFor(string $purpose): int
    {
        return match ($purpose) {
            // PIN change is more sensitive — give the user a tighter window
            self::PURPOSE_CHANGE_PIN => (int) config('otp.pin_change_expire_minutes', 5),
            default => (int) config('otp.expire_minutes', 10),
        };
    }

    /** Per-purpose daily limit override. Falls back to otp.resend_limit. */
    public static function dailyLimitFor(string $purpose): int
    {
        return match ($purpose) {
            self::PURPOSE_CHANGE_PIN => (int) config('otp.pin_change_daily_limit', 3),
            default => (int) config('otp.resend_limit', 3),
        };
    }

    /**
     * Generate a fresh OTP and invalidate any previous unused OTP
     * for the same (user, purpose). Returns the persisted Otp model.
     */
    public static function generate(User $user, string $purpose, ?string $ip = null): Otp
    {
        // Invalidate previous unused OTPs for this user+purpose
        Otp::query()
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        $length = (int) config('otp.length', 6);
        $max = (10 ** $length) - 1;
        $code = str_pad((string) random_int(0, $max), $length, '0', STR_PAD_LEFT);

        $otp = Otp::create([
            'user_id' => $user->id,
            // CHỈ lưu HASH của mã, không lưu mã rõ trong DB.
            'code' => hash('sha256', $code),
            'purpose' => $purpose,
            'expires_at' => now()->addMinutes(self::expireMinutesFor($purpose)),
            'request_ip' => $ip,
        ]);
        // Mã rõ chỉ sống trong RAM của request này — để gửi email / trả về dev.
        $otp->plainCode = $code;
        return $otp;
    }

    /**
     * Count OTPs created in the last 24h for a given (user, purpose). Used by
     * the PIN-change flow to enforce "3 requests per day" — beyond that we
     * 429 the user until tomorrow.
     */
    public static function countLastDay(\App\Models\User $user, string $purpose): int
    {
        return Otp::query()
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->where('created_at', '>=', now()->subDay())
            ->count();
    }

    /**
     * Send the OTP email. In dev (MAIL_MAILER=log) this writes to laravel.log.
     */
    public static function send(User $user, Otp $otp): void
    {
        try {
            Mail::to($user->email)->send(new SendOtpMail($user, $otp->plainCode ?? $otp->code, $otp->purpose));
        } catch (\Throwable $e) {
            // Mail failure must not block dev flow — log and continue.
            Log::error('OTP mail send failed', [
                'user_id' => $user->id,
                'purpose' => $otp->purpose,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Verify a submitted code. Returns true on first valid match and
     * marks the OTP used. Increments attempts on every call; locks the
     * OTP after max_attempts wrong tries.
     */
    public static function verify(User $user, string $code, string $purpose): bool
    {
        $otp = Otp::query()
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->whereNull('used_at')
            ->latest('id')
            ->first();

        if ($otp === null) {
            return false;
        }

        $otp->increment('attempts');

        $maxAttempts = (int) config('otp.max_attempts', 5);
        if ($otp->attempts > $maxAttempts) {
            $otp->update(['used_at' => now()]); // force-invalidate
            return false;
        }

        if ($otp->isExpired()) {
            return false;
        }

        // So khớp với HASH đã lưu (constant-time). Fallback so mã rõ cho các OTP
        // cũ tạo trước khi đổi sang hash, để không khoá người dùng đang chờ.
        $candidate = hash('sha256', $code);
        if (!hash_equals($otp->code, $candidate) && !hash_equals($otp->code, $code)) {
            return false;
        }

        $otp->update(['used_at' => now()]);
        return true;
    }

    /**
     * Returns true if user has hit the resend limit in the configured window.
     */
    public static function hasHitResendLimit(User $user, string $purpose): bool
    {
        $limit = (int) config('otp.resend_limit', 3);
        $windowMinutes = (int) config('otp.resend_window_minutes', 15);

        $recent = Otp::query()
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->where('created_at', '>=', now()->subMinutes($windowMinutes))
            ->count();

        return $recent >= $limit;
    }
}
