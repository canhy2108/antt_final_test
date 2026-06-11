<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Server-side biometric storage so the user can "tap face/fingerprint
 * button → scan → server matches → login" from ANY device, the way
 * Alipay / WeChat Pay / Techcombank work. The previous design stored
 * everything in the device's secure-store which broke cross-device.
 *
 * What goes on the server:
 *   - face_image_base64: small JPG (quality 0.3, ~10-20kB). Stored to enable
 *     a future face-similarity scan; current demo uses "most-recent-enrolled"
 *     matching but the column is here so swapping in a real embedding
 *     model later doesn't require another migration.
 *   - face_scan_ms: per-user signature
 *   - fingerprint_hold_ms: per-user signature (matched by closest within
 *     tolerance — see BiometricController::loginByFingerprint)
 *
 * (face_enrolled_at / fingerprint_enrolled_at already exist from migration
 *  2026_06_05_100000_add_bio_tracking_to_users.)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('face_image_base64')->nullable()->after('fingerprint_enrolled_at');
            $table->unsignedInteger('face_scan_ms')->nullable()->after('face_image_base64');
            $table->unsignedInteger('fingerprint_hold_ms')->nullable()->after('face_scan_ms');
        });
    }

    public function down(): void
    {
        if (\DB::connection()->getDriverName() === 'sqlite') {
            return; // SQLite older Laravel won't DROP COLUMN cleanly
        }
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['face_image_base64', 'face_scan_ms', 'fingerprint_hold_ms']);
        });
    }
};
