<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row = one enrolled face for a user. A user can have multiple
 * (no glasses, with glasses, low-light, etc.) — login picks the best
 * match via cosine distance on `face_embedding`.
 *
 * PRODUCTION: column `face_embedding` should be `VECTOR(512)` from
 * pgvector with an IVFFLAT / HNSW index. For the SQLite demo we cast
 * the JSON column to a PHP array and brute-force cosine distance in
 * MatchingService (fine for demo scale; rewrite to pgvector for prod).
 */
class FaceProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'label',
        'face_embedding',
        'template_version',
        'device_id',
        'enrolled_from_ip',
        'last_matched_at',
        'match_count',
    ];

    protected $casts = [
        'face_embedding' => 'array', // JSON ↔ PHP array of 512 floats
        'last_matched_at' => 'datetime',
        'match_count' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Increment the match counter + stamp last_matched_at after a successful login. */
    public function recordMatch(): void
    {
        $this->increment('match_count');
        $this->update(['last_matched_at' => now()]);
    }
}
