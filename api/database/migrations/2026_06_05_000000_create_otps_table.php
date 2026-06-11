<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('otps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('code', 10);
            // purpose: 'register' | 'reset_password' | 'sensitive' | 'change_email'
            $table->string('purpose', 30)->index();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->ipAddress('request_ip')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'purpose', 'used_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('otps');
    }
};
