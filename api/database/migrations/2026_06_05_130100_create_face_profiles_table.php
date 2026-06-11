<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Face profiles — multiple per user so the same person can enrol several
 * mặt: mặt thường, mặt đeo kính, mặt thiếu sáng, etc. Matches the spec
 * `User (1) <-> Face (N)`.
 *
 *   - `face_embedding` is a JSON-encoded 512-d float vector. In production
 *     this column should be `VECTOR(512)` from pgvector with an IVFFLAT
 *     or HNSW index for sub-millisecond cosine-distance kNN. For the
 *     SQLite demo we cosine-distance in PHP — slow but correct.
 *   - `template_version` lets us migrate when the embedding model changes
 *     (e.g., FaceNet → InsightFace → SeetaFace) without breaking older
 *     profiles. New embeddings can be computed lazily on next login.
 *   - `device_id` (Apple IDFV / Android ANDROID_ID) lets us bind enrolment
 *     to one phone for stronger auth — but we leave this nullable so the
 *     same face still works across devices, only with a warning surface.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('face_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('label', 50)->nullable(); // "Không kính", "Đeo kính", "Thiếu sáng"...
            // 512-d float vector encoded as JSON. Production: VECTOR(512).
            // SQLite stores it as TEXT internally; Laravel cast → array.
            $table->json('face_embedding');
            $table->string('template_version', 50)->default('demo_v1');
            $table->string('device_id', 255)->nullable();
            // Audit trail
            $table->ipAddress('enrolled_from_ip')->nullable();
            $table->timestamp('last_matched_at')->nullable();
            $table->unsignedInteger('match_count')->default(0);
            $table->timestamps();

            $table->index(['user_id', 'template_version']);
            $table->index('last_matched_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('face_profiles');
    }
};
