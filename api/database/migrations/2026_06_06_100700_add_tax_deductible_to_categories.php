<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            // Boolean flag — freelancers / household businesses use this for
            // year-end tax filing. Reports filter by it.
            $table->boolean('is_tax_deductible')->default(false)->after('icon');
        });
    }

    public function down(): void
    {
        if (\DB::connection()->getDriverName() === 'sqlite') return;
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('is_tax_deductible');
        });
    }
};
