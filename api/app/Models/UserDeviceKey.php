<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UserDeviceKey extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'device_fingerprint',
        'alias',
        'public_key',
        'algorithm',
        'kind',
        'last_used_at',
        'revoked_at',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    /** Don't leak the device fingerprint hash. */
    protected $hidden = ['device_fingerprint'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function nonces(): HasMany
    {
        return $this->hasMany(BiometricNonce::class);
    }

    public function isActive(): bool
    {
        return $this->revoked_at === null;
    }

    public function revoke(): void
    {
        $this->update(['revoked_at' => now()]);
    }
}
