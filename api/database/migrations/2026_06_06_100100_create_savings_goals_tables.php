<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Savings goals — "Tiết kiệm 50tr trong 6 tháng để mua MacBook".
 * Contributions ledger tracks each deposit/withdrawal toward the goal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('savings_goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);                          // "MacBook Pro M4"
            $table->string('icon', 50)->nullable();
            $table->string('color', 7)->nullable();
            $table->decimal('target_amount', 15, 2);
            $table->decimal('current_amount', 15, 2)->default(0);
            $table->string('currency', 3)->default('VND');
            $table->date('started_at');
            $table->date('target_date')->nullable();
            $table->date('completed_at')->nullable();

            // Optional: dedicate a specific account for this goal
            $table->foreignId('account_id')->nullable()->constrained('accounts')->nullOnDelete();

            // 'active' | 'completed' | 'paused' | 'abandoned'
            $table->string('status', 20)->default('active')->index();

            // Milestones reached — drives notifications. Stored as JSON array
            // of percentages already notified: [25, 50, 75, 100]
            $table->json('milestones_reached')->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        Schema::create('savings_goal_contributions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('goal_id')->constrained('savings_goals')->cascadeOnDelete();
            $table->decimal('amount', 15, 2);            // positive = deposit, negative = withdrawal
            $table->date('contributed_on');
            $table->foreignId('record_id')->nullable()->constrained('records')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('goal_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('savings_goal_contributions');
        Schema::dropIfExists('savings_goals');
    }
};
