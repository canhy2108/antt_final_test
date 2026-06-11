<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Multi-user shared accounts — gia đình dùng chung tài khoản "Sinh hoạt".
 * The owning user_id stays on `accounts`; additional collaborators join
 * via this table with a role (owner / editor / viewer).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('account_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // 'owner' | 'editor' | 'viewer'
            //   owner = full + can manage members
            //   editor = can read + create/edit/delete records
            //   viewer = read only
            $table->string('role', 20)->default('viewer');

            // Invitation flow
            $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('invited_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('revoked_at')->nullable();

            $table->timestamps();

            $table->unique(['account_id', 'user_id']);
            $table->index(['user_id', 'accepted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_members');
    }
};
