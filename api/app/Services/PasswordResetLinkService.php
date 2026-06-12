<?php

namespace App\Services;

use App\Models\PasswordResetLink;
use App\Models\User;

/**
 * Tầng 2 — "magic link" đặt lại mật khẩu (bỏ bước gõ mã 6 số tay).
 *
 * VÒNG ĐỜI TOKEN:
 *   issue()   → sinh token NGẪU NHIÊN 256-bit (CSPRNG), lưu sha256(token) vào
 *               DB, trả token THÔ cho caller (chỉ để nhúng vào URL email).
 *   consume() → nhận token thô từ deep link, băm lại, tra DB; nếu khớp + chưa
 *               dùng + chưa hết hạn → đánh dấu used_at và trả về User.
 *
 * BẤT BIẾN BẢO MẬT:
 *   - Token thô KHÔNG BAO GIỜ chạm DB hay log. DB chỉ giữ sha256 → kẻ đọc được
 *     DB cũng không tái tạo được link.
 *   - Single-use: consume() set used_at ngay; gọi lần 2 trả null.
 *   - Hết hạn ngắn (config otp.reset_link_expire_minutes, mặc định 30 phút).
 *   - Mỗi lần issue() vô hiệu hoá mọi link cũ chưa dùng của user → tránh tồn
 *     đọng nhiều link sống song song.
 */
class PasswordResetLinkService
{
    /** Thời hạn token (phút). */
    public static function ttlMinutes(): int
    {
        return (int) config('otp.reset_link_expire_minutes', 30);
    }

    /**
     * Đã chạm trần số lần xin link trong cửa sổ thời gian chưa?
     * Đếm theo bản ghi đã phát hành cho user (kể cả đã dùng) trong cửa sổ.
     */
    public static function hasHitLimit(User $user): bool
    {
        $limit = (int) config('otp.reset_link_limit', 3);
        $windowMinutes = (int) config('otp.reset_link_window_minutes', 15);

        $recent = PasswordResetLink::query()
            ->where('user_id', $user->id)
            ->where('created_at', '>=', now()->subMinutes($windowMinutes))
            ->count();

        return $recent >= $limit;
    }

    /**
     * Phát hành một magic link mới cho user. Trả về TOKEN THÔ (caller nhúng vào
     * URL rồi gửi email). KHÔNG log token ở bất kỳ đâu.
     */
    public static function issue(User $user, ?string $ip = null): string
    {
        // Vô hiệu hoá mọi link cũ chưa dùng — chỉ link mới nhất còn sống.
        PasswordResetLink::query()
            ->where('user_id', $user->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        // 32 bytes = 256-bit entropy, hex hoá thành 64 ký tự.
        $token = bin2hex(random_bytes(32));

        PasswordResetLink::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addMinutes(self::ttlMinutes()),
            'request_ip' => $ip,
        ]);

        return $token;
    }

    /**
     * Tiêu thụ một token thô từ deep link. Trả về User nếu hợp lệ, null nếu
     * token sai / đã dùng / hết hạn. Đánh dấu single-use NGAY khi hợp lệ.
     */
    public static function consume(string $token): ?User
    {
        // Token rỗng/sai định dạng → khỏi tra DB.
        if ($token === '') {
            return null;
        }

        $link = PasswordResetLink::query()
            ->where('token_hash', hash('sha256', $token))
            ->whereNull('used_at')
            ->first();

        if ($link === null || $link->isExpired()) {
            return null;
        }

        // Single-use: đốt token ngay lập tức.
        $link->update(['used_at' => now()]);

        return $link->user;
    }
}
