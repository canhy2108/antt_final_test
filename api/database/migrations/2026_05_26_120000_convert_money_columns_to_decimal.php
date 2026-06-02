<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Convert all monetary columns from FLOAT to DECIMAL.
 *
 * FLOAT loses precision (0.1 + 0.2 != 0.3). For a finance app this
 * silently corrupts balances over time. Money MUST be fixed-point.
 *
 * Uses raw SQL ALTER TABLE so we don't drag in doctrine/dbal just for
 * a one-shot type change. MySQL-only (project's deployment target).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!$this->isMysql()) {
            return;
        }

        DB::statement('ALTER TABLE accounts MODIFY initial_balance DECIMAL(19,4) NOT NULL DEFAULT 0');
        DB::statement('ALTER TABLE accounts MODIFY current_balance DECIMAL(19,4) NOT NULL DEFAULT 0');

        DB::statement('ALTER TABLE records MODIFY amount DECIMAL(19,4) NOT NULL');
        DB::statement('ALTER TABLE records MODIFY rate DECIMAL(19,9) NULL DEFAULT 1');

        DB::statement('ALTER TABLE budgets MODIFY amount DECIMAL(19,4) NOT NULL');
        DB::statement('ALTER TABLE upcoming_expenses MODIFY amount DECIMAL(19,4) NOT NULL');
        DB::statement('ALTER TABLE user_currencies MODIFY exchange_rate_to_default_currency DECIMAL(19,9) NULL DEFAULT 1');

        DB::statement('ALTER TABLE imports MODIFY file_size BIGINT UNSIGNED NOT NULL');
    }

    public function down(): void
    {
        if (!$this->isMysql()) {
            return;
        }

        DB::statement('ALTER TABLE accounts MODIFY initial_balance FLOAT NOT NULL DEFAULT 0');
        DB::statement('ALTER TABLE accounts MODIFY current_balance FLOAT NOT NULL DEFAULT 0');

        DB::statement('ALTER TABLE records MODIFY amount FLOAT NOT NULL');
        DB::statement('ALTER TABLE records MODIFY rate FLOAT NULL DEFAULT 1');

        DB::statement('ALTER TABLE budgets MODIFY amount FLOAT NOT NULL');
        DB::statement('ALTER TABLE upcoming_expenses MODIFY amount FLOAT NOT NULL');
        DB::statement('ALTER TABLE user_currencies MODIFY exchange_rate_to_default_currency FLOAT NULL DEFAULT 1');

        DB::statement('ALTER TABLE imports MODIFY file_size FLOAT NOT NULL');
    }

    private function isMysql(): bool
    {
        return DB::connection()->getDriverName() === 'mysql';
    }
};
