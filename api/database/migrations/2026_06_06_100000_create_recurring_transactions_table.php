<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Recurring transactions — lương 25 mỗi tháng, hoá đơn điện, gói Netflix.
 * A scheduled job (artisan command) advances `next_run_at` and spawns a
 * `records` row each time a recurrence fires.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recurring_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);                   // "Lương Cty FPT"
            $table->string('type', 20);                    // income | expense
            $table->decimal('amount', 15, 2);
            $table->foreignId('from_account_id')->constrained('accounts')->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('payment_method', 30)->nullable();
            $table->text('note')->nullable();

            // Cadence — daily | weekly | monthly | yearly
            $table->string('frequency', 20);
            $table->unsignedSmallInteger('interval')->default(1); // every N units
            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            $table->timestamp('next_run_at')->nullable()->index();
            $table->timestamp('last_run_at')->nullable();
            $table->unsignedInteger('run_count')->default(0);

            $table->boolean('is_active')->default(true)->index();
            $table->boolean('auto_create_record')->default(true);
            $table->boolean('notify_before')->default(true);  // ping user 1d before fire
            $table->timestamps();

            $table->index(['user_id', 'is_active', 'next_run_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recurring_transactions');
    }
};
