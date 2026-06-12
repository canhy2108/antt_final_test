<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bảng cho "magic link" đặt lại mật khẩu (Tầng 2 — bỏ gõ OTP tay).
 *
 * Khác `otps` (mã 6 số gõ tay) và `password_reset_tokens` (mặc định Laravel,
 * keyed theo email, thiếu user_id/expiry/used_at): bảng này lưu token NGẪU
 * NHIÊN 256-bit dùng-một-lần, gắn user_id, hết hạn ngắn.
 *
 * BẢO MẬT: cột `token_hash` chỉ chứa sha256(token_thô). Token gốc CHỈ tồn tại
 * trong URL gửi qua email — không bao giờ lưu DB, không bao giờ log. Kẻ đọc
 * được DB cũng không tái tạo được link.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('password_reset_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // sha256(token thô) = 64 ký tự hex. unique để tra cứu nhanh + chống trùng.
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable(); // != null => đã dùng (single-use)
            $table->ipAddress('request_ip')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'used_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_links');
    }
};
