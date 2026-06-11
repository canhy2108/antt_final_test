<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Personal debts & loans — tiền cho mượn (lent) and tiền đi vay (borrowed).
 * Critical for Vietnamese household finance — most expense apps miss this
 * and double-count when the money comes back.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('debts_loans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // 'lent' = cho mượn (debit while open, credit on settle)
            // 'borrowed' = đi vay (credit while open, debit on settle)
            $table->string('direction', 10)->index(); // 'lent' | 'borrowed'

            // Counterparty — free text (or could FK a future contacts table)
            $table->string('counterparty_name', 100);
            $table->string('counterparty_phone', 20)->nullable();

            $table->decimal('principal_amount', 15, 2);
            $table->decimal('remaining_amount', 15, 2); // updates on partial settlements
            $table->string('currency', 3)->default('VND');

            // 0 for interest-free family loans (most common). Annual rate %.
            $table->decimal('interest_rate', 5, 2)->default(0);
            $table->string('interest_type', 20)->nullable(); // 'simple' | 'compound' | null

            $table->date('started_at');
            $table->date('due_at')->nullable();
            $table->date('settled_at')->nullable();

            // 'open' | 'partially_settled' | 'settled' | 'overdue' | 'written_off'
            $table->string('status', 20)->default('open')->index();

            $table->text('notes')->nullable();
            // Link to the record(s) that created this debt — typically the
            // outgoing transfer record. Settlement records are tracked via
            // a separate debt_settlements table (next migration could add it).
            $table->foreignId('origin_record_id')->nullable()->constrained('records')->nullOnDelete();

            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'due_at']);
        });

        // Partial-settlement ledger (one debt can be paid down in tranches)
        Schema::create('debt_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('debt_id')->constrained('debts_loans')->cascadeOnDelete();
            $table->foreignId('record_id')->nullable()->constrained('records')->nullOnDelete();
            $table->decimal('amount', 15, 2);
            $table->date('settled_on');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index('debt_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('debt_settlements');
        Schema::dropIfExists('debts_loans');
    }
};
