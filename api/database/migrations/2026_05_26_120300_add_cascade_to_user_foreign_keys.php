<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add ON DELETE CASCADE for user-owned data.
 *
 * Originally every FK on user_id had no delete behavior — so deleting a
 * user left orphan accounts, records, budgets, categories, etc., which
 * later 500'd when joined back. Cascade keeps the model consistent: if a
 * user is hard-deleted (GDPR right-to-erasure), all their data goes too.
 *
 * Note: the codebase uses SoftDeletes on User, so cascade only fires on
 * actual hard-delete (forceDelete or admin tooling). Routine soft-deletes
 * are unaffected.
 */
return new class extends Migration
{
    public function up(): void
    {
        // SQLite cannot DROP FOREIGN KEY in-place — the migration is a no-op
        // there. For dev SQLite, foreign-key cascade can be controlled via
        // PRAGMA foreign_keys=ON; production MySQL still gets the proper
        // cascade behavior this migration was written for.
        if (\DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        $this->recreateUserFk('accounts');
        $this->recreateUserFk('records');
        $this->recreateUserFk('budgets');
        $this->recreateUserFk('upcoming_expenses');
        $this->recreateUserFk('imports');
        $this->recreateUserFk('user_currencies');
        $this->recreateUserFk('parent_categories');
        $this->recreateUserFk('categories');
    }

    public function down(): void
    {
        if (\DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        foreach ([
            'accounts', 'records', 'budgets', 'upcoming_expenses',
            'imports', 'user_currencies', 'parent_categories', 'categories',
        ] as $table) {
            Schema::table($table, function (Blueprint $t) use ($table) {
                $t->dropForeign("{$table}_user_id_foreign");
                $t->foreign('user_id')->references('id')->on('users');
            });
        }
    }

    private function recreateUserFk(string $table): void
    {
        if (!Schema::hasColumn($table, 'user_id')) {
            return;
        }

        Schema::table($table, function (Blueprint $t) use ($table) {
            // Drop the existing FK (may or may not be named conventionally).
            try {
                $t->dropForeign("{$table}_user_id_foreign");
            } catch (\Throwable $e) {
                // FK already missing or named differently — safe to ignore.
            }
            $t->foreign('user_id')
                ->references('id')->on('users')
                ->onDelete('cascade');
        });
    }
};
