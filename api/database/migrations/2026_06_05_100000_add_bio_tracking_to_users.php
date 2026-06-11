<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Track which biometric methods this user has registered for fast
            // login. Nullable timestamps act both as enabled-flag (non-null)
            // and audit trail (when was it set up). Synced from the FE
            // when the user completes the enrollment flow.
            $table->timestamp('face_enrolled_at')->nullable()->after('email_verified_at');
            $table->timestamp('fingerprint_enrolled_at')->nullable()->after('face_enrolled_at');

            // Track activity for the dashboard "last login" + analytics
            $table->timestamp('last_login_at')->nullable()->after('fingerprint_enrolled_at');
            $table->unsignedInteger('login_count')->default(0)->after('last_login_at');
        });
    }

    public function down(): void
    {
        // SQLite doesn't support DROP COLUMN well in older Laravel — guard.
        if (\DB::connection()->getDriverName() === 'sqlite') {
            return;
        }
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['face_enrolled_at', 'fingerprint_enrolled_at', 'last_login_at', 'login_count']);
        });
    }
};
