<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * AI / analytics insights, computed by a nightly job and cached here so
 * the dashboard reads pre-computed values instead of re-aggregating
 * thousands of records every refresh.
 *
 * Examples of `kind`:
 *   - weekly_spend_delta:   "Tuần này chi nhiều hơn tuần trước 40%"
 *   - top_category:         "Top 3 chi tiêu tháng: Ăn uống / Đi lại / Shopping"
 *   - upcoming_recurring:   "Lương sẽ về 25/06 — 12tr"
 *   - budget_warning:       "Đã chi 87% ngân sách Ăn uống tháng"
 *   - anomaly:              "Giao dịch 5tr ở 03:00AM — bất thường, xác nhận?"
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('spending_insights', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 50)->index();
            $table->string('title');
            $table->text('body')->nullable();
            $table->json('data')->nullable();       // {category_id, amount, percent, ...}
            $table->string('severity', 20)->default('info'); // info | warning | critical
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
            $table->timestamp('valid_until')->nullable()->index(); // null = until refreshed
            $table->timestamp('dismissed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'dismissed_at']);
            $table->index(['user_id', 'kind', 'valid_until']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('spending_insights');
    }
};
