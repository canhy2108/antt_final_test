<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Device-bound biometric credential. See migration for the security model.
 *
 * One row = (user, device, kind). Re-enrolling on the same device replaces
 * the row via updateOrCreate so a phone never accumulates dead tokens.
 */
class BiometricCredential extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'device_fingerprint',
        'kind',
        'token_hash',
        'label',
        'expires_at',
        'last_used_at',
        'revoked_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'last_used_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    /** The plaintext token hash is sensitive; never expose it via JSON. */
    protected $hidden = ['token_hash', 'device_fingerprint'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        if ($this->revoked_at !== null) return false;
        if ($this->expires_at !== null && $this->expires_at->isPast()) return false;
        return true;
    }

    public function recordUse(): void
    {
        $this->update(['last_used_at' => now()]);
    }

    public function revoke(): void
    {
        $this->update(['revoked_at' => now()]);
    }
}
