<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Device extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'device_fingerprint', 'name', 'platform', 'os_version',
        'app_version', 'last_ip', 'last_location', 'first_seen_at',
        'last_seen_at', 'is_trusted', 'revoked_at',
    ];

    protected $casts = [
        'first_seen_at' => 'datetime',
        'last_seen_at' => 'datetime',
        'revoked_at' => 'datetime',
        'is_trusted' => 'boolean',
    ];

    // Don't leak the raw fingerprint hash in user-facing responses
    protected $hidden = ['device_fingerprint'];

    public function user(): BelongsTo            { return $this->belongsTo(User::class); }
    public function sessions(): HasMany          { return $this->hasMany(UserSession::class); }

    /** Mark a device as trusted so subsequent logins from it skip step-up MFA. */
    public function trust(): void
    {
        $this->update(['is_trusted' => true]);
    }

    public function revoke(): void
    {
        $this->update(['revoked_at' => now()]);
        // Also revoke any live sessions on this device
        $this->sessions()->whereNull('revoked_at')->update(['revoked_at' => now()]);
    }
}
