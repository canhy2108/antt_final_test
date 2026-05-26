<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Make users.name NOT NULL to match the validation contract.
 *
 * AuthController validates name as required, but the column was nullable.
 * Backfill nulls with `user_<id>` placeholder, then enforce NOT NULL.
 *
 * Raw SQL to avoid pulling in doctrine/dbal for a single column change.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::table('users')
            ->whereNull('name')
            ->update(['name' => DB::raw("CONCAT('user_', id)")]);

        DB::statement('ALTER TABLE users MODIFY name VARCHAR(255) NOT NULL');
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('ALTER TABLE users MODIFY name VARCHAR(255) NULL');
    }
};
