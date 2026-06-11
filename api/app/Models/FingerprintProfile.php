<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FingerprintProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'label',
        'fingerprint_template',
        'template_version',
        'hold_ms',
        'device_id',
        'enrolled_from_ip',
        'last_matched_at',
        'match_count',
    ];

    protected $casts = [
        'last_matched_at' => 'datetime',
        'hold_ms' => 'integer',
        'match_count' => 'integer',
    ];

    /** The vendor SDK template is sensitive — never serialize to the client. */
    protected $hidden = ['fingerprint_template'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function recordMatch(): void
    {
        $this->increment('match_count');
        $this->update(['last_matched_at' => now()]);
    }
}
