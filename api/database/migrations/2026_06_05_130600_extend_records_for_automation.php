<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Extend `records` (the transactions table) so we can:
 *   - distinguish payment_method (bank_transfer / card / cash / qr / e_wallet)
 *     → "habits" reports
 *   - mark records that were auto-created from a bank notification, and
 *     link back so the user can audit the source SMS
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('records', function (Blueprint $table) {
            $table->string('payment_method', 30)->nullable()->after('amount');
            $table->boolean('is_automated')->default(false)->after('payment_method');
            $table->foreignId('linked_notification_id')
                ->nullable()
                ->after('is_automated')
                ->constrained('bank_notifications')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (\DB::connection()->getDriverName() === 'sqlite') return;
        Schema::table('records', function (Blueprint $table) {
            $table->dropConstrainedForeignId('linked_notification_id');
            $table->dropColumn(['payment_method', 'is_automated']);
        });
    }
};
