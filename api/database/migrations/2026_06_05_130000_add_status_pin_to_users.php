<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bring `users` closer to the production-grade schema:
 *   - status enum (active / locked / pending_otp / disabled)
 *   - pin_hash (server-side mirror of the device PIN — used as a stronger
 *     gate for sensitive operations and to enable "forgot PIN" via OTP)
 *   - last_failed_login_at / failed_login_attempts (per-user lockout)
 *
 * password_hash already exists as `password` and now uses Argon2id (see
 * config/hashing.php).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // SQLite has no native ENUM — Laravel falls back to VARCHAR
            // with a CHECK constraint. Keep the value-set small so it
            // matches the production PostgreSQL enum 1:1.
            $table->string('status', 20)->default('active')->after('email_verified_at');
            $table->string('pin_hash')->nullable()->after('password');
            $table->timestamp('last_failed_login_at')->nullable()->after('last_login_at');
            $table->unsignedTinyInteger('failed_login_attempts')->default(0)->after('last_failed_login_at');
        });
    }

    public function down(): void
    {
        if (\DB::connection()->getDriverName() === 'sqlite') return;
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['status', 'pin_hash', 'last_failed_login_at', 'failed_login_attempts']);
        });
    }
};
