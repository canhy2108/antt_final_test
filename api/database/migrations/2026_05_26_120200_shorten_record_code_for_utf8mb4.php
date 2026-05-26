<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Shrink records.code so its UNIQUE index fits MySQL's utf8mb4 limit.
 *
 * 4 bytes/char * 191 chars = 764 bytes (under the 767-byte cap on
 * configurations without innodb_large_prefix).
 *
 * Raw SQL to avoid the doctrine/dbal dependency that `->change()` needs.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        // The unique index name Laravel generates is records_code_unique.
        DB::statement('ALTER TABLE records DROP INDEX records_code_unique');
        DB::statement('ALTER TABLE records MODIFY code VARCHAR(191) NULL');
        DB::statement('ALTER TABLE records ADD UNIQUE records_code_unique (code)');
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('ALTER TABLE records DROP INDEX records_code_unique');
        DB::statement('ALTER TABLE records MODIFY code VARCHAR(255) NULL');
        DB::statement('ALTER TABLE records ADD UNIQUE records_code_unique (code)');
    }
};
