<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankNotification extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'sender',
        'raw_content',
        'parsed_amount',
        'parsed_account_mask',
        'parsed_merchant',
        'parsed_transacted_at',
        'transaction_type',
        'processed_status',
        'failure_reason',
        'record_id',
    ];

    protected $casts = [
        'parsed_amount' => 'decimal:2',
        'parsed_transacted_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function record(): BelongsTo
    {
        return $this->belongsTo(Record::class);
    }
}
