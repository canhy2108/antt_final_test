<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TotpSecret extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'secret_encrypted', 'backup_codes_encrypted',
        'backup_codes_used', 'is_enabled', 'enabled_at', 'last_verified_at',
    ];

    /**
     * AES-256-CBC at rest. Reading decrypts transparently; writing encrypts.
     * If APP_KEY leaks, secrets leak — keep APP_KEY in a vault in prod.
     */
    protected $casts = [
        'secret_encrypted' => 'encrypted',
        'backup_codes_encrypted' => 'encrypted:array', // encrypted JSON array
        'is_enabled' => 'boolean',
        'enabled_at' => 'datetime',
        'last_verified_at' => 'datetime',
    ];

    // NEVER ship to clients — they only need to know enabled-or-not
    protected $hidden = ['secret_encrypted', 'backup_codes_encrypted'];

    public function user(): BelongsTo            { return $this->belongsTo(User::class); }
}
