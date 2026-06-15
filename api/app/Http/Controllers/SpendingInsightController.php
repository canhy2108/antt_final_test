<?php

namespace App\Http\Controllers;

use App\Models\SpendingInsight;
use App\Models\Notification;
use App\Services\SpendingAnomalyService;
use Illuminate\Http\Request;

/**
 * Cảnh báo chi tiêu bất thường.
 *
 *   GET  /api/insights            — danh sách cảnh báo còn hiệu lực
 *   POST /api/insights/scan       — chạy phát hiện, lưu cảnh báo + gửi thông báo
 *   POST /api/insights/{id}/dismiss — bỏ qua một cảnh báo
 */
class SpendingInsightController extends Controller
{
    public function index(Request $request)
    {
        $userId = $request->user()->id;
        $items = SpendingInsight::where('user_id', $userId)
            ->whereNull('dismissed_at')
            ->where(function ($q) {
                $q->whereNull('valid_until')->orWhere('valid_until', '>', now());
            })
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['insights' => $items]);
    }

    public function scan(Request $request, SpendingAnomalyService $svc)
    {
        $userId = $request->user()->id;
        $anomalies = $svc->detect($userId);

        // Làm mới: gỡ các cảnh báo CHƯA bị bỏ qua để thay bằng kết quả mới nhất.
        SpendingInsight::where('user_id', $userId)->whereNull('dismissed_at')->delete();

        $created = [];
        foreach ($anomalies as $a) {
            $created[] = SpendingInsight::create([
                'user_id' => $userId,
                'kind' => $a['kind'],
                'title' => $a['title'],
                'body' => $a['body'],
                'data' => $a['data'],
                'severity' => $a['severity'],
                'period_start' => now()->startOfMonth()->toDateString(),
                'period_end' => now()->toDateString(),
                'valid_until' => now()->addDays(30),
            ]);

            // Gửi thông báo, tránh trùng trong 24h.
            $dup = Notification::where('user_id', $userId)
                ->where('type', 'spending_anomaly')
                ->where('title', $a['title'])
                ->where('created_at', '>=', now()->subDay())
                ->exists();
            if (!$dup) {
                Notification::create([
                    'user_id' => $userId,
                    'type' => 'spending_anomaly',
                    'title' => $a['title'],
                    'body' => $a['body'],
                    'data' => array_merge($a['data'], ['severity' => $a['severity']]),
                ]);
            }
        }

        return response()->json(['count' => count($created), 'insights' => $created]);
    }

    public function dismiss(Request $request, $id)
    {
        $insight = SpendingInsight::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();
        $insight->update(['dismissed_at' => now()]);

        return response()->json(['ok' => true]);
    }
}
