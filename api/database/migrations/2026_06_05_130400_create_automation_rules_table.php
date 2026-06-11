<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-user rules for the bank-SMS → transaction pipeline. Each rule is a
 * keyword (or regex) that, when found in a bank notification, maps the
 * resulting record to a specific account + category. Lets the user say
 * "any SMS containing 'GRAB' should be Account=VCB-Salary, Category=Đi
 * lại" — and stop touching the app for 80% of transactions.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automation_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Display name e.g. "Grab → Đi lại"
            $table->string('name', 100);

            // Optional sender filter ("Vietcombank" / "BIDV") — if null, applies
            // to any sender.
            $table->string('sender_filter', 80)->nullable();

            // Keyword (substring) or regex pattern depending on `match_mode`
            $table->string('keyword', 200);
            // 'contains' | 'starts_with' | 'regex'
            $table->string('match_mode', 20)->default('contains');

            // Where to apply the match
            $table->foreignId('target_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('default_category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('payment_method', 30)->nullable(); // 'bank_transfer' | 'card' | 'cash' | 'qr'

            // Rules with lower priority numbers fire first. Lets the user pin
            // a specific match above a broader catch-all.
            $table->unsignedSmallInteger('priority')->default(100);

            $table->boolean('is_active')->default(true)->index();
            $table->unsignedInteger('match_count')->default(0);
            $table->timestamp('last_matched_at')->nullable();

            $table->timestamps();

            $table->index(['user_id', 'is_active', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_rules');
    }
};
