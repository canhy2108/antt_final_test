<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpendingInsight extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'kind', 'title', 'body', 'data', 'severity',
        'period_start', 'period_end', 'valid_until', 'dismissed_at',
    ];

    protected $casts = [
        'data' => 'array',
        'period_start' => 'date',
        'period_end' => 'date',
        'valid_until' => 'datetime',
        'dismissed_at' => 'datetime',
    ];

    public function user(): BelongsTo            { return $this->belongsTo(User::class); }

    public function scopeActive($query)
    {
        return $query->whereNull('dismissed_at')
            ->where(fn ($q) => $q->whereNull('valid_until')->orWhere('valid_until', '>', now()));
    }
}
