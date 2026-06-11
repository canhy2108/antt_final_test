<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            // Event taxonomy — must mirror AuthController::auditLog() events:
            // 'login_success', 'login_failed', 'login_rate_limited',
            // 'self_register', 'otp_verify_failed', 'otp_verify_success',
            // 'otp_resent', 'sensitive_otp_requested', 'pin_change_otp_*',
            // 'bio_enrolled', 'logout', 'user_registered'.
            $table->string('event', 60)->index();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            // Free-form context (device id, retry_after, attempt count, etc.)
            $table->json('metadata')->nullable();

            $table->timestamp('created_at')->useCurrent()->index();

            $table->index(['user_id', 'created_at']);
            $table->index(['event', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
