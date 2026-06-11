<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'sender_filter',
        'keyword',
        'match_mode',
        'target_account_id',
        'default_category_id',
        'payment_method',
        'priority',
        'is_active',
        'match_count',
        'last_matched_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'priority' => 'integer',
        'match_count' => 'integer',
        'last_matched_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function targetAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'target_account_id');
    }

    public function defaultCategory(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'default_category_id');
    }

    /** True if this rule's pattern matches the given bank-notification text. */
    public function matches(string $text, ?string $sender = null): bool
    {
        if ($this->sender_filter && $sender && stripos($sender, $this->sender_filter) === false) {
            return false;
        }
        $kw = $this->keyword;
        return match ($this->match_mode) {
            'starts_with' => stripos($text, $kw) === 0,
            'regex' => (bool) @preg_match($kw, $text),
            default => stripos($text, $kw) !== false, // 'contains'
        };
    }
}
