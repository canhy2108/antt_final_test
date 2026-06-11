<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Categorization — drives the icon + colour in the FE.
            // 'budget_exceeded' | 'low_balance' | 'large_transaction'
            // | 'security_alert' | 'welcome' | 'bio_enrolled' | 'system'
            $table->string('type', 50)->index();

            $table->string('title', 200);
            $table->text('body')->nullable();
            // Free-form context (transaction_id, account_id, threshold_amount...)
            $table->json('data')->nullable();

            // null = unread. Indexed so the unread-count badge is a single
            // index scan instead of a full table scan as notifications pile up.
            $table->timestamp('read_at')->nullable()->index();
            $table->timestamps();

            $table->index(['user_id', 'read_at']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
