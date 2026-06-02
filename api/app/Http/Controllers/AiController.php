<?php

namespace App\Http\Controllers;

use App\Models\Record;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

class AiController extends Controller
{
    public static function trainModel()
    {
        $records = DB::table('records')
            ->select('name', 'category_id', 'type', 'amount')
            ->whereNot('category_id', 44)
            ->whereNotNull('name')
            ->whereNotNull('category_id')
            ->get();

        $data = json_encode($records->toArray());

        $process = new Process(['python3', '/var/www/html/app/Ai/train_and_predict.py', 'train', $data]);
        $process->run();

        if (!$process->isSuccessful()) {
            $error = $process->getErrorOutput();
            logger()->error('Training Process Failed: ' . $error);
        }
    }

    public static function trainModelWithRecord(Record $record)
    {

        if (!file_exists(storage_path('app/ai/models/category_predictor.pkl'))) {
            self::trainModel();
        }

        $data = json_encode([[
            'name' => $record->name,
            'category_id' => $record->category_id
        ]]);

        $process = new Process(['python3', '/var/www/html/app/Ai/train_and_predict.py', 'train', $data]);
        $process->run();

        if (!$process->isSuccessful()) {
            $error = $process->getErrorOutput();
            logger()->error('Training Process Failed: ' . $error);
        }
    }

    public static function predictCategory(string $name)
    {
        $defaultCategoryId = (int) config('budgetbee.default_category_id', 44);

        $data = json_encode([[
            'name' => $name
        ]]);

        $process = new Process(['python3', '/var/www/html/app/Ai/train_and_predict.py', 'predict', $data]);
        $process->run();

        if (!$process->isSuccessful()) {
            $error = $process->getErrorOutput();
            logger()->error('Predict Process Failed: ' . $error);
        }

        $category_id = trim($process->getOutput());

        $category = is_numeric($category_id) ? Category::find((int) $category_id) : null;

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
