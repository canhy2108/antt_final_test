<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * "Magic link" đặt lại mật khẩu (Tầng 2 — bỏ gõ OTP tay).
 *
 * BẢO MẬT: cột `token_hash` chỉ chứa sha256(token thô). Token gốc CHỈ tồn tại
 * trong URL gửi qua email — không bao giờ lưu DB, không bao giờ log. Single-use
 * qua `used_at`, hết hạn ngắn qua `expires_at`, gắn cứng `user_id`.
 */
class PasswordResetLink extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'token_hash',
        'expires_at',
        'used_at',
        'request_ip',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
    ];

    // Băm token là dữ liệu nhạy cảm — không bao giờ serialize ra JSON.
    protected $hidden = ['token_hash'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function isUsed(): bool
    {
        return $this->used_at !== null;
    }

    public function isValid(): bool
    {
        return !$this->isExpired() && !$this->isUsed();
    }
}
