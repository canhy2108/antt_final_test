<?php

namespace App\Http\Controllers;

use App\Models\Record;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

class AiController extends Controller
{
    private static function aiEnabled(): bool
    {
        return (bool) config('budgetbee.ai_enabled', false);
    }

    /**
     * Chạy script python AN TOÀN: có timeout, bắt mọi lỗi, KHÔNG bao giờ ném
     * ngoại lệ hay treo request. Trả về stdout hoặc null nếu lỗi.
     */
    private static function runPython(array $args): ?string
    {
        try {
            $bin = config('budgetbee.python_bin', 'python3');
            $script = base_path('app/Ai/train_and_predict.py');
            $process = new Process(array_merge([$bin, $script], $args));
            $process->setTimeout(8);
            $process->run();
            if (!$process->isSuccessful()) {
                logger()->warning('AI process failed: ' . $process->getErrorOutput());
                return null;
            }
            return $process->getOutput();
        } catch (\Throwable $e) {
            logger()->warning('AI process exception: ' . $e->getMessage());
            return null;
        }
    }

    public static function trainModel()
    {
        if (!self::aiEnabled()) {
            return;
        }
        $records = DB::table('records')
            ->select('name', 'category_id', 'type', 'amount')
            ->whereNot('category_id', 44)
            ->whereNotNull('name')
            ->whereNotNull('category_id')
            ->get();

        self::runPython(['train', json_encode($records->toArray())]);
    }

    public static function trainModelWithRecord(Record $record)
    {
        // TẮT mặc định → tạo giao dịch không gọi python (tránh treo request).
        if (!self::aiEnabled()) {
            return;
        }
        if (!file_exists(storage_path('app/ai/models/category_predictor.pkl'))) {
            self::trainModel();
        }
        self::runPython(['train', json_encode([[
            'name' => $record->name,
            'category_id' => $record->category_id,
        ]])]);
    }

    public static function predictCategory(string $name)
    {
        $defaultCategoryId = (int) config('budgetbee.default_category_id', 44);

        if (!self::aiEnabled()) {
            return Category::find($defaultCategoryId);
        }

        $out = self::runPython(['predict', json_encode([['name' => $name]])]);
        $categoryId = $out !== null ? trim($out) : '';

        $category = is_numeric($categoryId) ? Category::find((int) $categoryId) : null;
        if (!$category) {
            $category = Category::find($defaultCategoryId);
        }

        return $category;
    }

    public function predictCategoryRequest(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|min:1|max:255'
        ]);

        $category = $this->predictCategory($validated['name']);

        if (!$category) {
            return response()->json([
                'message' => 'Could not predict category'
            ], 500);
        }

        return response()->json([
            'category' => $category->id,
            'parent_category' => $category->parent_category_id
        ]);
    }
}
