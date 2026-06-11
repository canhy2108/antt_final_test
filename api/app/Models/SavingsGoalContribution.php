<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SavingsGoalContribution extends Model
{
    use HasFactory;

    protected $fillable = ['goal_id', 'amount', 'contributed_on', 'record_id', 'notes'];

    protected $casts = [
        'amount' => 'decimal:2',
        'contributed_on' => 'date',
    ];

    public function goal(): BelongsTo            { return $this->belongsTo(SavingsGoal::class, 'goal_id'); }
    public function record(): BelongsTo          { return $this->belongsTo(Record::class); }
}
