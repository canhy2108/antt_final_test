<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecurringTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'name', 'type', 'amount', 'from_account_id', 'category_id',
        'payment_method', 'note', 'frequency', 'interval', 'starts_on',
        'ends_on', 'next_run_at', 'last_run_at', 'run_count', 'is_active',
        'auto_create_record', 'notify_before',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'starts_on' => 'date',
        'ends_on' => 'date',
        'next_run_at' => 'datetime',
        'last_run_at' => 'datetime',
        'is_active' => 'boolean',
        'auto_create_record' => 'boolean',
        'notify_before' => 'boolean',
        'interval' => 'integer',
        'run_count' => 'integer',
    ];

    public function user(): BelongsTo            { return $this->belongsTo(User::class); }
    public function fromAccount(): BelongsTo     { return $this->belongsTo(Account::class, 'from_account_id'); }
    public function category(): BelongsTo        { return $this->belongsTo(Category::class); }

    /** Compute the next firing time from the current next_run_at. */
    public function advanceCursor(): void
    {
        $base = $this->next_run_at ?? now();
        $next = match ($this->frequency) {
            'daily' => Carbon::parse($base)->addDays($this->interval),
            'weekly' => Carbon::parse($base)->addWeeks($this->interval),
            'yearly' => Carbon::parse($base)->addYears($this->interval),
            default => Carbon::parse($base)->addMonths($this->interval),
        };

        if ($this->ends_on && $next->gt($this->ends_on)) {
            $this->is_active = false;
            $next = null;
        }

        $this->update([
            'last_run_at' => $base,
            'next_run_at' => $next,
            'run_count' => $this->run_count + 1,
            'is_active' => $this->is_active,
        ]);
    }
}
