<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bank-SMS / push-notification queue for auto-categorisation.
 *
 * The phone runs an Android NotificationListenerService (or iOS Shortcut)
 * that POSTs each bank notification here. The server parses, applies
 * automation_rules, and either auto-creates a transaction or leaves the
 * row in `processed_status=pending` for the user to confirm.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // "Vietcombank", "BIDV", "+84909...". Used by automation_rules to
            // pick which parser/account to apply.
            $table->string('sender', 80);
            $table->text('raw_content');

            // Parsed fields (best-effort; null when regex didn't match)
            $table->decimal('parsed_amount', 15, 2)->nullable();
            $table->string('parsed_account_mask', 50)->nullable(); // "***1234"
            $table->string('parsed_merchant', 200)->nullable();
            $table->timestamp('parsed_transacted_at')->nullable();

            // 'in' = tiền vào (income), 'out' = tiền ra (expense),
            // null = chưa phân loại (lỗi parse hoặc OTP/thông báo khác)
            $table->string('transaction_type', 10)->nullable();

            // 'pending' | 'completed' | 'failed' | 'ignored' | 'duplicate'
            $table->string('processed_status', 20)->default('pending')->index();
            $table->text('failure_reason')->nullable();

            // FK to the record that was generated (or null if pending/ignored)
            $table->foreignId('record_id')->nullable()->constrained('records')->nullOnDelete();

            $table->timestamps();

            $table->index(['user_id', 'processed_status']);
            $table->index(['user_id', 'created_at']);
            // Helps the de-dup query: did we already process this exact SMS?
            $table->index(['user_id', 'sender', 'parsed_amount', 'parsed_transacted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_notifications');
    }
};
