<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'device_id', 'personal_access_token_id', 'auth_method',
        'ip_address', 'user_agent', 'started_at', 'last_active_at',
        'expires_at', 'revoked_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'last_active_at' => 'datetime',
        'expires_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function user(): BelongsTo            { return $this->belongsTo(User::class); }
    public function device(): BelongsTo          { return $this->belongsTo(Device::class); }

    public function isActive(): bool
    {
        return $this->revoked_at === null
            && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    /** Revoke this session AND the linked Sanctum token. */
    public function revoke(): void
    {
        if ($this->revoked_at) return;
        $this->update(['revoked_at' => now()]);
        if ($this->personal_access_token_id) {
            \Laravel\Sanctum\PersonalAccessToken::where('id', $this->personal_access_token_id)->delete();
        }
    }
}
