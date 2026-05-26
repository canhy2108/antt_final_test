<?php

namespace App\Listeners;

use App\Events\UserCreated;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\ParentCategory;
use App\Models\Category;

class AssignCategorySeeder
{
    use InteractsWithQueue;

    /**
     * Seed default category tree for a freshly-created user.
     *
     * Wrapped in a transaction so a failure halfway through doesn't leave
     * the user with a partial category list. firstOrCreate makes the
     * listener idempotent — safe if the event fires twice (e.g. retry).
     */
    public function handle(UserCreated $event)
    {
        $json = file_get_contents(database_path('seeders/data/categories.json'));
        $data = json_decode($json, true);

        if (!is_array($data)) {
            Log::warning('AssignCategorySeeder: categories.json missing or invalid');
            return;
        }

        DB::transaction(function () use ($event, $data) {
            foreach ($data as $parentCategory) {
                $newParentCategory = ParentCategory::firstOrCreate(
                    [
                        'user_id' => $event->user->id,
                        'name' => $parentCategory['name'],
                    ],
                    [
                        'color' => $parentCategory['color'],
                        'icon' => $parentCategory['icon'],
                    ]
                );

                foreach ($parentCategory['categories'] as $category) {
                    Category::firstOrCreate(
                        [
                            'user_id' => $event->user->id,
                            'parent_category_id' => $newParentCategory->id,
                            'name' => $category['name'],
                        ],
                        [
                            'icon' => $category['icon'],
                        ]
                    );
                }
            }
        });
    }
}
