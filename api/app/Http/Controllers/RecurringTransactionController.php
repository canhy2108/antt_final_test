<?php

namespace App\Http\Controllers;

use App\Models\Record;
use App\Models\RecurringTransaction;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RecurringTransactionController extends Controller
{
    public function index(Request $request)
    {
        $rows = RecurringTransaction::where('user_id', $request->user()->id)
            ->orderByDesc('is_active')
            ->orderBy('next_run_at')
            ->get();

        return response()->json([
            'items' => $rows,
            'active_count' => $rows->where('is_active', true)->count(),
            'next_upcoming' => $rows->where('is_active', true)->sortBy('next_run_at')->first(),
        ]);
    }

    public function store(Request $request)
    {
        $v = $request->validate([
            'name' => 'required|string|max:100',
            'type' => 'required|in:income,expense',
            'amount' => 'required|numeric|min:0.01',
            'from_account_id' => 'required|exists:accounts,id',
            'category_id' => 'nullable|exists:categories,id',
            'payment_method' => 'nullable|string|max:30',
            'note' => 'nullable|string|max:500',
            'frequency' => 'required|in:daily,weekly,monthly,yearly',
            'interval' => 'nullable|integer|min:1|max:365',
            'starts_on' => 'required|date',
            'ends_on' => 'nullable|date|after:starts_on',
            'auto_create_record' => 'nullable|boolean',
            'notify_before' => 'nullable|boolean',
        ]);

        $row = RecurringTransaction::create([
            ...$v,
            'user_id' => $request->user()->id,
            'interval' => $v['interval'] ?? 1,
            'next_run_at' => Carbon::parse($v['starts_on']),
            'is_active' => true,
        ]);

        return response()->json($row, 201);
    }

    public function show(Request $request, $id)
    {
        $row = RecurringTransaction::findOrFail($id);
        $this->ownerCheck($row, $request);
        return response()->json($row);
    }

    public function update(Request $request, $id)
    {
        $row = RecurringTransaction::findOrFail($id);
        $this->ownerCheck($row, $request);

        $v = $request->validate([
            'name' => 'sometimes|string|max:100',
            'amount' => 'sometimes|numeric|min:0.01',
            'category_id' => 'sometimes|nullable|exists:categories,id',
            'payment_method' => 'sometimes|nullable|string|max:30',
            'note' => 'sometimes|nullable|string|max:500',
            'frequency' => 'sometimes|in:daily,weekly,monthly,yearly',
            'interval' => 'sometimes|integer|min:1|max:365',
            'ends_on' => 'sometimes|nullable|date',
            'is_active' => 'sometimes|boolean',
            'auto_create_record' => 'sometimes|boolean',
            'notify_before' => 'sometimes|boolean',
        ]);
        $row->update($v);
        return response()->json($row);
    }

    public function destroy(Request $request, $id)
    {
        $row = RecurringTransaction::findOrFail($id);
        $this->ownerCheck($row, $request);
        $row->delete();
        return response()->json(['ok' => true]);
    }

    /**
     * Manually fire this recurrence now — useful for "Paid early" cases and
     * for the demo (instead of waiting for the cron job).
     */
    public function runNow(Request $request, $id)
    {
        $rec = RecurringTransaction::findOrFail($id);
        $this->ownerCheck($rec, $request);

        if (!$rec->is_active) {
            return response()->json(['message' => 'Recurrence is not active'], 409);
        }

        $record = DB::transaction(function () use ($rec) {
            $record = Record::create([
                'user_id' => $rec->user_id,
                'date' => $rec->next_run_at?->toDateString() ?? now()->toDateString(),
                'from_account_id' => $rec->from_account_id,
                'type' => $rec->type,
                'category_id' => $rec->category_id,
                'name' => $rec->name,
                'amount' => $rec->amount,
                'payment_method' => $rec->payment_method,
                'is_automated' => true,
            ]);
            $rec->advanceCursor();
            return $record;
        });

        return response()->json([
            'message' => 'Recurrence fired',
            'record' => $record,
            'recurring' => $rec->fresh(),
        ]);
    }

    private function ownerCheck(RecurringTransaction $row, Request $request): void
    {
        if ($row->user_id !== $request->user()->id) {
            abort(403);
        }
    }
}
