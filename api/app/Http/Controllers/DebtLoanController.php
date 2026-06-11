<?php

namespace App\Http\Controllers;

use App\Models\DebtLoan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Personal debts & loans CRUD.
 *   - GET   /api/debts-loans              → list (scoped to user)
 *   - GET   /api/debts-loans/{id}         → detail with settlements
 *   - POST  /api/debts-loans              → create
 *   - POST  /api/debts-loans/{id}         → update
 *   - DELETE /api/debts-loans/{id}        → delete
 *   - POST  /api/debts-loans/{id}/settle  → record a partial/full repayment
 */
class DebtLoanController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = DebtLoan::where('user_id', $user->id);

        if ($request->filled('direction')) {
            $query->where('direction', $request->query('direction'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $rows = $query->orderByRaw("CASE status WHEN 'overdue' THEN 0 WHEN 'open' THEN 1 WHEN 'partially_settled' THEN 2 ELSE 3 END")
            ->orderBy('due_at')
            ->orderByDesc('created_at')
            ->get();

        // Roll up: total lent (asset), total borrowed (liability)
        $totals = [
            'lent_remaining' => round((float) $rows->where('direction', 'lent')->sum('remaining_amount'), 2),
            'borrowed_remaining' => round((float) $rows->where('direction', 'borrowed')->sum('remaining_amount'), 2),
            'overdue_count' => $rows->where('is_overdue', true)->count(),
        ];

        return response()->json([
            'items' => $rows,
            'totals' => $totals,
        ]);
    }

    public function show(Request $request, $id)
    {
        $debt = DebtLoan::with('settlements')->findOrFail($id);
        $this->authorizeOwnership($debt, $request);
        return response()->json($debt);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'direction' => 'required|in:lent,borrowed',
            'counterparty_name' => 'required|string|max:100',
            'counterparty_phone' => 'nullable|string|max:20',
            'principal_amount' => 'required|numeric|min:0.01',
            'currency' => 'nullable|string|size:3',
            'interest_rate' => 'nullable|numeric|min:0|max:1000',
            'interest_type' => 'nullable|in:simple,compound',
            'started_at' => 'required|date',
            'due_at' => 'nullable|date|after_or_equal:started_at',
            'notes' => 'nullable|string|max:1000',
        ]);

        $debt = DebtLoan::create([
            ...$validated,
            'user_id' => $request->user()->id,
            'remaining_amount' => $validated['principal_amount'],
            'status' => 'open',
            'currency' => $validated['currency'] ?? 'VND',
        ]);

        Log::channel('audit')->info('debt_created', [
            'user_id' => $request->user()->id,
            'debt_id' => $debt->id,
            'direction' => $debt->direction,
            'amount' => $debt->principal_amount,
        ]);

        return response()->json($debt, 201);
    }

    public function update(Request $request, $id)
    {
        $debt = DebtLoan::findOrFail($id);
        $this->authorizeOwnership($debt, $request);

        $validated = $request->validate([
            'counterparty_name' => 'sometimes|string|max:100',
            'counterparty_phone' => 'sometimes|nullable|string|max:20',
            'due_at' => 'sometimes|nullable|date',
            'notes' => 'sometimes|nullable|string|max:1000',
            'interest_rate' => 'sometimes|nullable|numeric|min:0|max:1000',
            'interest_type' => 'sometimes|nullable|in:simple,compound',
            // principal/remaining/status are NOT user-mutable here — they
            // flow only through settle() to keep the ledger consistent.
        ]);

        $debt->update($validated);
        return response()->json($debt);
    }

    public function destroy(Request $request, $id)
    {
        $debt = DebtLoan::findOrFail($id);
        $this->authorizeOwnership($debt, $request);

        if ($debt->settlements()->exists()) {
            return response()->json([
                'message' => 'Đã có settlement — không thể xoá. Bạn có thể đánh dấu "written_off" thay vì xoá.',
            ], 409);
        }

        $debt->delete();
        return response()->json(['ok' => true]);
    }

    public function settle(Request $request, $id)
    {
        $debt = DebtLoan::findOrFail($id);
        $this->authorizeOwnership($debt, $request);

        if ($debt->status === 'settled') {
            return response()->json(['message' => 'Khoản này đã trả hết'], 409);
        }

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01|max:' . $debt->remaining_amount,
            'settled_on' => 'required|date',
            'notes' => 'nullable|string|max:500',
        ]);

        $settlement = $debt->applySettlement(
            (float) $validated['amount'],
            $validated['settled_on'],
            $validated['notes'] ?? null,
        );

        Log::channel('audit')->info('debt_settled', [
            'user_id' => $request->user()->id,
            'debt_id' => $debt->id,
            'amount' => $validated['amount'],
            'new_status' => $debt->status,
        ]);

        return response()->json([
            'settlement' => $settlement,
            'debt' => $debt->fresh(['settlements']),
        ]);
    }

    private function authorizeOwnership(DebtLoan $debt, Request $request): void
    {
        if ($debt->user_id !== $request->user()->id) {
            abort(403, 'Không có quyền truy cập');
        }
    }
}
