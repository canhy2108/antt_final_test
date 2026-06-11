<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A single debt/loan agreement. `direction = 'lent'` means the user gave
 * money to someone (asset); `'borrowed'` means the user owes (liability).
 *
 * Settlements (partial repayments) live in the related debt_settlements
 * table — `remaining_amount` is updated on each settlement and `status`
 * flips to `settled` when it reaches zero.
 */
class DebtLoan extends Model
{
    use HasFactory;

    protected $table = 'debts_loans';

    protected $fillable = [
        'user_id',
        'direction',
        'counterparty_name',
        'counterparty_phone',
        'principal_amount',
        'remaining_amount',
        'currency',
        'interest_rate',
        'interest_type',
        'started_at',
        'due_at',
        'settled_at',
        'status',
        'notes',
        'origin_record_id',
    ];

    protected $casts = [
        'principal_amount' => 'decimal:2',
        'remaining_amount' => 'decimal:2',
        'interest_rate' => 'decimal:2',
        'started_at' => 'date',
        'due_at' => 'date',
        'settled_at' => 'date',
    ];

    protected $appends = ['is_overdue', 'days_until_due'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function settlements(): HasMany
    {
        return $this->hasMany(DebtSettlement::class, 'debt_id');
    }

    public function originRecord(): BelongsTo
    {
        return $this->belongsTo(Record::class, 'origin_record_id');
    }

    public function getIsOverdueAttribute(): bool
    {
        return $this->due_at !== null
            && $this->due_at->isPast()
            && in_array($this->status, ['open', 'partially_settled'], true);
    }

    public function getDaysUntilDueAttribute(): ?int
    {
        if ($this->due_at === null) return null;
        return now()->startOfDay()->diffInDays($this->due_at, false);
    }

    /** Apply a settlement to this debt; auto-update status. */
    public function applySettlement(float $amount, string $settledOn, ?string $notes = null): DebtSettlement
    {
        $settlement = $this->settlements()->create([
            'amount' => $amount,
            'settled_on' => $settledOn,
            'notes' => $notes,
        ]);

        $newRemaining = max(0, (float) $this->remaining_amount - $amount);
        $this->update([
            'remaining_amount' => $newRemaining,
            'status' => $newRemaining <= 0.005 ? 'settled' : 'partially_settled',
            'settled_at' => $newRemaining <= 0.005 ? $settledOn : null,
        ]);

        return $settlement;
    }
}
