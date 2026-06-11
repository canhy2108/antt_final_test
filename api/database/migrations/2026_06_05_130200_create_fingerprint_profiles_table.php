<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fingerprint profiles — multiple per user (ngón trỏ trái, ngón trỏ phải,
 * ngón cái...). In production each row stores a SecuGen / ZKTeco-style
 * encrypted template; in the demo we store the "hold duration signature"
 * captured by the press-and-hold UI as the placeholder template.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fingerprint_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('label', 50)->nullable(); // "Ngón trỏ phải", "Ngón cái trái"...
            // Production: BLOB of the vendor SDK template (already AES-encrypted
            // by the SDK itself). Demo: TEXT carrying the hold pattern JSON.
            $table->text('fingerprint_template');
            $table->string('template_version', 50)->default('demo_holdpattern_v1');
            // Demo-only signature for matching — hold_ms within tolerance
            $table->unsignedInteger('hold_ms')->nullable();
            $table->string('device_id', 255)->nullable();
            $table->ipAddress('enrolled_from_ip')->nullable();
            $table->timestamp('last_matched_at')->nullable();
            $table->unsignedInteger('match_count')->default(0);
            $table->timestamps();

            $table->index(['user_id', 'template_version']);
            $table->index('hold_ms');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fingerprint_profiles');
    }
};
