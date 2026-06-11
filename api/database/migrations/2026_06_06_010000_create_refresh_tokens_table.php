<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refresh_tokens', function (Blueprint $table) {
            $table->id();
            $table->uuid('jti')->unique();
            $table->unsignedBigInteger('user_id');
            $table->string('device_id', 128)->nullable();
            $table->string('token_hash', 128)->index();
            $table->boolean('is_revoked')->default(false)->index();
            $table->timestamp('expires_at')->nullable()->index();
            $table->unsignedBigInteger('replaced_by')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refresh_tokens');
    }
};
