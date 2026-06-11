<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DebtSettlement extends Model
{
    use HasFactory;

    protected $fillable = [
        'debt_id',
        'record_id',
        'amount',
        'settled_on',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'settled_on' => 'date',
    ];

    public function debt(): BelongsTo
    {
        return $this->belongsTo(DebtLoan::class, 'debt_id');
    }

    public function record(): BelongsTo
    {
        return $this->belongsTo(Record::class);
    }
}
