<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add bank_name + encrypted account_number to `accounts`. The full account
 * number is stored encrypted at the app layer (Laravel's `encrypted` cast,
 * AES-256-CBC) — never queryable, never logged. The last 4 digits live in
 * a separate column for display purposes ("Vietcombank ****1234").
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->string('bank_name', 100)->nullable()->after('name');
            // Long enough for max bank account length + encryption overhead
            $table->text('account_number_encrypted')->nullable()->after('bank_name');
            $table->string('account_number_last4', 8)->nullable()->after('account_number_encrypted');
        });
    }

    public function down(): void
    {
        if (\DB::connection()->getDriverName() === 'sqlite') return;
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn(['bank_name', 'account_number_encrypted', 'account_number_last4']);
        });
    }
};
