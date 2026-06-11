<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TOTP 2FA secrets (RFC 6238). One row per user. The `secret_encrypted`
 * column is AES-256-CBC encrypted at the app layer via Laravel's
 * `encrypted` cast — if the DB is exfiltrated, the secret is useless
 * without APP_KEY. `backup_codes` are one-time codes the user can use
 * if they lose access to their authenticator app.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('totp_secrets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            // base32 secret (16 bytes → 32 base32 chars), AES-encrypted blob
            $table->text('secret_encrypted');
            // Recovery codes (8-digit each), AES-encrypted as JSON
            $table->text('backup_codes_encrypted')->nullable();
            $table->unsignedTinyInteger('backup_codes_used')->default(0);
            $table->boolean('is_enabled')->default(false);
            $table->timestamp('enabled_at')->nullable();
            $table->timestamp('last_verified_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('totp_secrets');
    }
};
