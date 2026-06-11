<?php

namespace App\Http\Controllers;

use App\Models\SavingsGoal;
use Illuminate\Http\Request;

class SavingsGoalController extends Controller
{
    public function index(Request $request)
    {
        $rows = SavingsGoal::where('user_id', $request->user()->id)
            ->orderByRaw("CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END")
            ->orderBy('target_date')
            ->get();

        $active = $rows->where('status', 'active');
        return response()->json([
            'items' => $rows,
            'active_count' => $active->count(),
            'total_target' => round((float) $active->sum('target_amount'), 2),
            'total_saved' => round((float) $active->sum('current_amount'), 2),
        ]);
    }

    public function store(Request $request)
    {
        $v = $request->validate([
            'name' => 'required|string|max:100',
            'icon' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:7',
            'target_amount' => 'required|numeric|min:1',
            'currency' => 'nullable|string|size:3',
            'started_at' => 'required|date',
            'target_date' => 'nullable|date|after:started_at',
            'account_id' => 'nullable|exists:accounts,id',
            'notes' => 'nullable|string|max:1000',
        ]);

        $goal = SavingsGoal::create([
            ...$v,
            'user_id' => $request->user()->id,
            'currency' => $v['currency'] ?? 'VND',
            'current_amount' => 0,
            'status' => 'active',
            'milestones_reached' => [],
        ]);

        return response()->json($goal, 201);
    }

    public function show(Request $request, $id)
    {
        $goal = SavingsGoal::with('contributions')->findOrFail($id);
        $this->ownerCheck($goal, $request);
        return response()->json($goal);
    }

    public function update(Request $request, $id)
    {
        $goal = SavingsGoal::findOrFail($id);
        $this->ownerCheck($goal, $request);

        $v = $request->validate([
            'name' => 'sometimes|string|max:100',
            'icon' => 'sometimes|nullable|string|max:50',
            'color' => 'sometimes|nullable|string|max:7',
            'target_amount' => 'sometimes|numeric|min:1',
            'target_date' => 'sometimes|nullable|date',
            'status' => 'sometimes|in:active,completed,paused,abandoned',
            'notes' => 'sometimes|nullable|string|max:1000',
        ]);
        $goal->update($v);
        return response()->json($goal);
    }

    public function destroy(Request $request, $id)
    {
        $goal = SavingsGoal::findOrFail($id);
        $this->ownerCheck($goal, $request);
        $goal->delete();
        return response()->json(['ok' => true]);
    }

    /**
     * Add a contribution to the goal. Auto-fires milestone notifications
     * via SavingsGoal::contribute().
     */
    public function contribute(Request $request, $id)
    {
        $goal = SavingsGoal::findOrFail($id);
        $this->ownerCheck($goal, $request);

        $v = $request->validate([
            'amount' => 'required|numeric',
            'contributed_on' => 'required|date',
            'notes' => 'nullable|string|max:500',
        ]);

        if ($goal->status === 'completed') {
            return response()->json(['message' => 'Mục tiêu đã hoàn thành'], 409);
        }

        $result = $goal->contribute((float) $v['amount'], $v['contributed_on'], $v['notes'] ?? null);

        return response()->json([
            'contribution' => $result['contribution'],
            'crossed_milestone' => $result['crossed_milestone'],
            'goal' => $goal->fresh(),
        ]);
    }

    private function ownerCheck(SavingsGoal $row, Request $request): void
    {
        if ($row->user_id !== $request->user()->id) {
            abort(403);
        }
    }
}
