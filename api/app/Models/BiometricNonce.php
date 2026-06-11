<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BiometricNonce extends Model
{
    use HasFactory;

    protected $fillable = [
        'nonce_hash',
        'user_device_key_id',
        'expires_at',
        'used_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
    ];

    /** Never serialize the hash. */
    protected $hidden = ['nonce_hash'];

    public function userDeviceKey(): BelongsTo
    {
        return $this->belongsTo(UserDeviceKey::class);
    }

    public function isUsable(): bool
    {
        if ($this->used_at !== null) return false;
        if ($this->expires_at->isPast()) return false;
        return true;
    }

    public function consume(): void
    {
        $this->update(['used_at' => now()]);
    }
}
