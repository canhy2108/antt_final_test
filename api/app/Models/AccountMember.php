<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountMember extends Model
{
    use HasFactory;

    protected $fillable = [
        'account_id', 'user_id', 'role', 'invited_by', 'invited_at', 'accepted_at', 'revoked_at',
    ];

    protected $casts = [
        'invited_at' => 'datetime',
        'accepted_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function account(): BelongsTo         { return $this->belongsTo(Account::class); }
    public function user(): BelongsTo            { return $this->belongsTo(User::class); }
    public function inviter(): BelongsTo         { return $this->belongsTo(User::class, 'invited_by'); }

    public function isActive(): bool
    {
        return $this->accepted_at !== null && $this->revoked_at === null;
    }

    public function canEdit(): bool
    {
        return $this->isActive() && in_array($this->role, ['owner', 'editor'], true);
    }
}
