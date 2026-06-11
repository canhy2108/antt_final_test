<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReceiptUpload extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'file_path', 'mime_type', 'file_size_bytes',
        'ocr_result', 'status', 'record_id',
    ];

    protected $casts = [
        'ocr_result' => 'array',
        'file_size_bytes' => 'integer',
    ];

    public function user(): BelongsTo            { return $this->belongsTo(User::class); }
    public function record(): BelongsTo          { return $this->belongsTo(Record::class); }
}
