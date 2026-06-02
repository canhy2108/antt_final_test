<?php

use App\Models\User;
use App\Models\UserCurrency;
use App\Models\Types\Currency;
use Database\Seeders\CurrencySeeder;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Run CurrencySeeder inline (was previously fired via DatabaseSeeder
        // with a magic 5-second sleep — fragile and order-dependent).
        (new CurrencySeeder())->run();

        $usd = Currency::where('code', 'USD')->first();
        if (!$usd) {
            // CurrencySeeder failed or data file missing — bail rather than
            // crash mid-loop with a null deref.
            return;
        }

        foreach (User::all() as $user) {
            if ($user->currency) continue;

            $userCurrency = UserCurrency::firstOrCreate(
                ['user_id' => $user->id, 'currency_id' => $usd->id],
                ['exchange_rate_to_default_currency' => 1]
            );

            $user->fill(['currency_id' => $userCurrency->id])->save();
        }
    }
};
