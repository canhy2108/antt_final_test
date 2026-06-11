<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SavingsGoal extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'name', 'icon', 'color', 'target_amount', 'current_amount',
        'currency', 'started_at', 'target_date', 'completed_at', 'account_id',
        'status', 'milestones_reached', 'notes',
    ];

    protected $casts = [
        'target_amount' => 'decimal:2',
        'current_amount' => 'decimal:2',
        'started_at' => 'date',
        'target_date' => 'date',
        'completed_at' => 'date',
        'milestones_reached' => 'array',
    ];

    protected $appends = ['progress_percent', 'days_left'];

    public function user(): BelongsTo            { return $this->belongsTo(User::class); }
    public function account(): BelongsTo         { return $this->belongsTo(Account::class); }
    public function contributions(): HasMany     { return $this->hasMany(SavingsGoalContribution::class, 'goal_id'); }

    public function getProgressPercentAttribute(): float
    {
        if ($this->target_amount <= 0) return 0;
        return round(min(100, ((float) $this->current_amount / (float) $this->target_amount) * 100), 1);
    }

    public function getDaysLeftAttribute(): ?int
    {
        return $this->target_date ? (int) now()->startOfDay()->diffInDays($this->target_date, false) : null;
    }

    /**
     * Add a contribution + auto-trigger notification on milestone crossings.
     * Returns ['contribution', 'crossed_milestone'].
     */
    public function contribute(float $amount, string $on, ?string $notes = null): array
    {
        $contribution = $this->contributions()->create([
            'amount' => $amount,
            'contributed_on' => $on,
            'notes' => $notes,
        ]);

        $newCurrent = max(0, (float) $this->current_amount + $amount);
        $newPercent = $this->target_amount > 0 ? ($newCurrent / (float) $this->target_amount) * 100 : 0;

        // Detect milestone crossings (25/50/75/100)
        $already = $this->milestones_reached ?? [];
        $crossed = null;
        foreach ([25, 50, 75, 100] as $m) {
            if ($newPercent >= $m && !in_array($m, $already, true)) {
                $already[] = $m;
                $crossed = $m;
            }
        }

        $status = $this->status;
        $completedAt = $this->completed_at;
        if ($newPercent >= 100) {
            $status = 'completed';
            $completedAt = $on;
        }

        $this->update([
            'current_amount' => $newCurrent,
            'milestones_reached' => $already,
            'status' => $status,
            'completed_at' => $completedAt,
        ]);

        // Fire a notification on milestone (best-effort; non-blocking)
        if ($crossed !== null) {
            try {
                Notification::create([
                    'user_id' => $this->user_id,
                    'type' => 'system',
                    'title' => $crossed === 100
                        ? "🎉 Hoàn thành mục tiêu \"{$this->name}\"!"
                        : "🎯 Đã đạt {$crossed}% mục tiêu \"{$this->name}\"",
                    'body' => $crossed === 100
                        ? 'Chúc mừng! Bạn đã tiết kiệm đủ.'
                        : "Tiếp tục cố lên! Còn " . (100 - $crossed) . "% nữa thôi.",
                    'data' => ['goal_id' => $this->id, 'milestone' => $crossed],
                ]);
            } catch (\Throwable $e) {
                // swallow — milestone notification is non-essential
            }
        }

        return ['contribution' => $contribution, 'crossed_milestone' => $crossed];
    }
}
