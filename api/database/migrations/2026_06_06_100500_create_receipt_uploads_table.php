<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Receipt photos with OCR results. The FE uploads a photo, server stores
 * it in storage/app/receipts, optionally runs OCR (Google Vision /
 * Tesseract / locally-hosted PaddleOCR) and stores the structured result.
 * The user reviews + confirms, then a `records` row is generated.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('receipt_uploads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Relative path inside storage disk (private). Never publicly served.
            $table->string('file_path');
            $table->string('mime_type', 60)->nullable();
            $table->unsignedInteger('file_size_bytes')->nullable();
            // Parsed by the OCR step. Free-form so we can iterate the schema
            // without migrations.
            //  { "merchant": "Highlands Coffee", "total": 75000,
            //    "items": [...], "transacted_at": "2026-06-05T10:30:00Z",
            //    "currency": "VND", "ocr_confidence": 0.92 }
            $table->json('ocr_result')->nullable();
            // 'pending' | 'ocr_running' | 'ocr_failed' | 'awaiting_confirm' | 'confirmed' | 'discarded'
            $table->string('status', 20)->default('pending')->index();
            $table->foreignId('record_id')->nullable()->constrained('records')->nullOnDelete();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('receipt_uploads');
    }
};
