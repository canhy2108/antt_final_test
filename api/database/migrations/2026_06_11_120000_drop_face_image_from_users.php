<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * GỠ BỎ dữ liệu sinh trắc học thô: cột trên `users` + 2 bảng template mồ côi.
 *
 * Lý do (pháp lý + bảo mật — bắt buộc):
 *   - `face_image_base64` lưu ẢNH KHUÔN MẶT dạng plaintext. Khuôn mặt là
 *     dữ liệu sinh trắc học nhạy cảm theo Luật Bảo vệ dữ liệu cá nhân 2025
 *     (Luật 91/2025/QH15, hiệu lực 01/01/2026). Lưu thô = vi phạm, phạt tới
 *     5% doanh thu hoặc 3 tỷ đồng.
 *   - Thiết kế đăng nhập sinh trắc HIỆN TẠI (BiometricController + bảng
 *     `biometric_credentials` + bio_token gắn thiết bị, gated bởi Face ID /
 *     vân tay của OS) KHÔNG đọc/ghi mấy cột này. Chúng là tàn dư của thiết
 *     kế cũ "match khuôn mặt gần nhất / hold-time gần nhất" đã bị thay thế.
 *     => Xoá an toàn, không phá vỡ luồng đăng nhập.
 *   - `face_scan_ms` / `fingerprint_hold_ms` là "chữ ký thời gian" của thiết
 *     kế cũ, cũng không còn dùng.
 *   - 2 bảng `face_profiles` (face_embedding JSON 512-d) và
 *     `fingerprint_profiles` (fingerprint_template + hold_ms) là nơi chứa
 *     TEMPLATE sinh trắc của thiết kế cũ. Không controller/service nào dùng
 *     (grep toàn `app/`), đang rỗng, nhưng schema vẫn mời gọi việc ghi
 *     template về sau → drop luôn để khép bề mặt rủi ro (cùng nhóm vi phạm
 *     Luật 91/2025/QH15).
 *
 * Sau migration: app chỉ còn dựa vào sinh trắc của HỆ ĐIỀU HÀNH (Secure
 * Enclave / Android Keystore). App không bao giờ chạm tới khuôn mặt thô,
 * và CSDL không còn bảng nào để chứa template sinh trắc.
 */
return new class extends Migration
{
    public function up(): void
    {
        // (1) Drop các cột sinh trắc thô trên `users` (nếu còn tồn tại) →
        // idempotent, chạy lại không lỗi.
        $cols = array_values(array_filter(
            ['face_image_base64', 'face_scan_ms', 'fingerprint_hold_ms'],
            fn ($c) => Schema::hasColumn('users', $c),
        ));

        if (!empty($cols)) {
            Schema::table('users', function (Blueprint $table) use ($cols) {
                // Laravel 11 drop được nhiều cột trên cả SQLite lẫn MySQL.
                $table->dropColumn($cols);
            });
        }

        // (2) Drop 2 bảng "template sinh trắc" mồ côi của thiết kế cũ. Đặt
        // SAU phần cột (không nằm trong early-return) để dù cột đã bị gỡ từ
        // trước thì bảng vẫn được dọn. dropIfExists → idempotent.
        Schema::dropIfExists('fingerprint_profiles');
        Schema::dropIfExists('face_profiles');
    }

    public function down(): void
    {
        // CỐ TÌNH không khôi phục `face_image_base64` lẫn 2 bảng template
        // (face_profiles / fingerprint_profiles): tái tạo nơi chứa dữ liệu
        // sinh trắc thô đi ngược lại mục đích của migration. Chỉ phục hồi 2
        // cột timing (vô hại) để rollback schema không vỡ.
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'face_scan_ms')) {
                $table->unsignedInteger('face_scan_ms')->nullable();
            }
            if (!Schema::hasColumn('users', 'fingerprint_hold_ms')) {
                $table->unsignedInteger('fingerprint_hold_ms')->nullable();
            }
        });
    }
};
