<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add indexes on frequently-queried columns.
 *
 * The original schema declared foreign keys (which create indexes), but
 * many queries filter by user_id + date or user_id + type without using
 * the FK. Without these indexes, every dashboard / report query does a
 * full table scan once a user has a few thousand records.
 *
 * Composite indexes are ordered most-selective-first (user_id always first
 * because every query is user-scoped).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('records', function (Blueprint $table) {
            $table->index(['user_id', 'date'], 'records_user_date_idx');
            $table->index(['user_id', 'category_id'], 'records_user_category_idx');
            $table->index(['user_id', 'type'], 'records_user_type_idx');
            $table->index(['from_account_id', 'date'], 'records_account_date_idx');
        });

        Schema::table('accounts', function (Blueprint $table) {
            $table->index(['user_id', 'position'], 'accounts_user_position_idx');
        });

        Schema::table('budgets', function (Blueprint $table) {
            $table->index(['user_id', 'category_id'], 'budgets_user_category_idx');
        });

        Schema::table('upcoming_expenses', function (Blueprint $table) {
            $table->index(['user_id', 'due_date'], 'upcoming_user_due_idx');
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->index(['user_id', 'parent_category_id'], 'categories_user_parent_idx');
        });

        Schema::table('parent_categories', function (Blueprint $table) {
            $table->index('user_id', 'parent_categories_user_idx');
        });
    }

    public function down(): void
    {
        Schema::table('records', function (Blueprint $table) {
            $table->dropIndex('records_user_date_idx');
            $table->dropIndex('records_user_category_idx');
            $table->dropIndex('records_user_type_idx');
            $table->dropIndex('records_account_date_idx');
        });

        Schema::table('accounts', function (Blueprint $table) {
            $table->dropIndex('accounts_user_position_idx');
        });

        Schema::table('budgets', function (Blueprint $table) {
            $table->dropIndex('budgets_user_category_idx');
        });

        Schema::table('upcoming_expenses', function (Blueprint $table) {
            $table->dropIndex('upcoming_user_due_idx');
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->dropIndex('categories_user_parent_idx');
        });

        Schema::table('parent_categories', function (Blueprint $table) {
            $table->dropIndex('parent_categories_user_idx');
        });
    }
};
