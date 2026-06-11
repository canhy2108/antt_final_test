<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hardware-backed biometric public keys (Phase B).
 *
 * Goes one step beyond `biometric_credentials` (Phase A):
 *
 *   - In Phase A the client stores a server-issued opaque `bio_token` and
 *     replays it after the OS biometric prompt. If a rooted device can
 *     extract the token, the attacker can replay it from any device that
 *     fakes the same device_fingerprint.
 *
 *   - Phase B replaces the opaque token with an asymmetric keypair. The
 *     PRIVATE key is generated INSIDE the Secure Enclave (iOS) or
 *     StrongBox / TEE (Android) with `setUserAuthenticationRequired(true)`
 *     and `setInvalidatedByBiometricEnrollment(true)`. The private key
 *     never leaves hardware — even root cannot exfiltrate it. The PUBLIC
 *     key is sent to the server at enrolment and stored here.
 *
 *   - At login the server issues a one-shot random `nonce`. The client
 *     prompts the OS biometric; on success the hardware signs the nonce
 *     with the in-enclave private key and returns the signature. The
 *     server verifies with the stored public key. No shared secret on the
 *     wire — replay is impossible (nonce is used once) and exfil is
 *     impossible (private key is hardware-bound).
 *
 * Algorithm: ECDSA on P-256 with SHA-256 (matches Apple Secure Enclave's
 * only supported algorithm and Android Keystore's `setDigests(SHA256)`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_device_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Same SHA-256 fingerprint as `biometric_credentials.device_fingerprint`
            // so a single device can have BOTH a Phase A credential and a
            // Phase B keypair (during the migration period).
            $table->string('device_fingerprint', 128);
            // Local alias the client used to generate the keypair (eg.
            // "budgetbee_face_v1"). Sent back on sign requests so the
            // native module knows which key to load.
            $table->string('alias', 64);
            // Public key as base64-encoded SubjectPublicKeyInfo / X.509
            // (Android Keystore's default export) or X9.63 (iOS Secure
            // Enclave). We accept both formats — the algorithm field tells
            // the server which parser to use.
            $table->text('public_key');
            $table->string('algorithm', 32)->default('ES256'); // ES256 = ECDSA P-256 + SHA-256
            // 'face' | 'fingerprint' — which OS biometric class unlocked
            // the key on enrolment. Lets us revoke face / fingerprint
            // independently if needed.
            $table->string('kind', 20);
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'device_fingerprint', 'kind'], 'udk_unique');
            $table->index('device_fingerprint');
        });

        Schema::create('biometric_nonces', function (Blueprint $table) {
            $table->id();
            // One nonce per (device_fingerprint, key) — server-issued, used
            // once, expires fast. Stored hashed so a DB leak does not let
            // an attacker pre-sign future nonces.
            $table->string('nonce_hash', 64);
            $table->foreignId('user_device_key_id')
                ->constrained('user_device_keys')
                ->cascadeOnDelete();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();

            $table->index('nonce_hash');
            $table->index(['user_device_key_id', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('biometric_nonces');
        Schema::dropIfExists('user_device_keys');
    }
};
