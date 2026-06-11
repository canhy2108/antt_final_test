<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Device-bound biometric credentials — the only secure way to do
 * passwordless biometric login from a mobile app.
 *
 * The previous design ("match by most-recent-enrolled-face" /
 * "match by closest-hold-time") let ANY scan log into ANY account.
 * This table replaces it with the WebAuthn / FIDO-style pattern that
 * Alipay / WeChat Pay / banks actually use:
 *
 *   1. After password login the client asks the OS biometric prompt
 *      (Face ID / Touch ID / Android fingerprint). The OS — NOT the
 *      app — actually verifies the user's face/finger.
 *   2. On success the server generates a cryptographically random
 *      `bio_token`, hashes it (SHA-256), and stores ONLY the hash here,
 *      bound to (user_id, device_fingerprint, kind).
 *   3. The plaintext token is returned ONCE and stored client-side in
 *      iOS Keychain / Android Keystore behind a biometric gate.
 *   4. To login: client passes OS biometric → unlocks token → POSTs
 *      (credential_id, bio_token, device_fingerprint). Server compares
 *      hash with constant-time compare and issues a Sanctum token.
 *
 * Why this is secure:
 *   - Without the stored bio_token the attacker cannot login, even
 *     with a perfect face/fingerprint photo of the victim.
 *   - The bio_token is bound to the device; stealing it from one device
 *     does not let it work from another.
 *   - The OS biometric prompt is the actual biometric check.
 *   - Server stores only the hash; DB leak does not let an attacker
 *     replay credentials.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('biometric_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // SHA-256 of the client's device fingerprint (IDFV / ANDROID_ID +
            // random per-install salt). Same fingerprint as devices.device_fingerprint
            // so the two tables can be joined for device management.
            $table->string('device_fingerprint', 128);
            // 'face' | 'fingerprint' — different OS biometric kinds get
            // separate credentials so the user can revoke one without the other.
            $table->string('kind', 20);
            // SHA-256 hex of the bio_token. We never store the plaintext.
            $table->string('token_hash', 64);
            // Human label for the devices screen ("iPhone 15 Pro của Linh — Face")
            $table->string('label', 100)->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            // A given device gets ONE credential per kind per user. Re-enrolling
            // replaces the old token (handled by updateOrCreate in the controller).
            $table->unique(['user_id', 'device_fingerprint', 'kind'], 'bio_creds_unique');
            $table->index(['device_fingerprint', 'kind']);
            $table->index('token_hash');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('biometric_credentials');
    }
};
