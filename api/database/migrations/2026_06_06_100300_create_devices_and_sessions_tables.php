<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Device & session tracking. Lets the user see "Where am I logged in?"
 * and revoke a session from another device (Facebook/Google pattern).
 *
 * Sanctum already gives us a personal_access_tokens row per token — the
 * `user_sessions` table here is the user-facing view of that, joined
 * with device metadata + last-seen activity. The session points back to
 * the Sanctum token via `personal_access_token_id` so revocation is
 * a simple `tokens()->where(id, $tokenId)->delete()`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Stable per-device identifier (IDFV iOS / ANDROID_ID). Hashed
            // on the client to avoid leaking PII to the server.
            $table->string('device_fingerprint', 128)->index();
            $table->string('name', 100)->nullable(); // "iPhone 15 Pro của Linh"
            $table->string('platform', 30)->nullable(); // 'ios' | 'android' | 'web'
            $table->string('os_version', 50)->nullable();
            $table->string('app_version', 50)->nullable();
            $table->ipAddress('last_ip')->nullable();
            $table->string('last_location', 100)->nullable(); // "Hà Nội, VN" — from GeoIP
            $table->timestamp('first_seen_at');
            $table->timestamp('last_seen_at');
            $table->boolean('is_trusted')->default(false); // user confirmed this device
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'device_fingerprint']);
            $table->index(['user_id', 'last_seen_at']);
        });

        Schema::create('user_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('device_id')->nullable()->constrained('devices')->nullOnDelete();
            // Link to Sanctum's token row so we can revoke server-side.
            $table->foreignId('personal_access_token_id')
                ->nullable()
                ->constrained('personal_access_tokens')
                ->nullOnDelete();
            // 'password' | 'face' | 'fingerprint' | 'totp'
            $table->string('auth_method', 20);
            $table->ipAddress('ip_address')->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->timestamp('started_at');
            $table->timestamp('last_active_at');
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'revoked_at']);
            $table->index(['user_id', 'last_active_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('devices');
    }
};
