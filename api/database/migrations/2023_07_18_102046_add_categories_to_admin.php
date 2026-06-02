<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\ParentCategory;
use App\Models\Category;

return new class extends Migration
{
    /**
     * Backfill user_id on legacy null-owner category rows.
     *
     * Originally hardcoded user_id=1 (admin). If user 1 was soft-deleted or
     * never created, that left orphan rows pointing at a non-existent user.
     * Resolve to the lowest-id existing user instead, or skip entirely if
     * the install is empty.
     */
    public function up(): void
    {
        $ownerId = User::orderBy('id')->value('id');
        if (!$ownerId) {
            return;
        }

        ParentCategory::whereNull('user_id')->update(['user_id' => $ownerId]);
        Category::whereNull('user_id')->update(['user_id' => $ownerId]);
    }

};
