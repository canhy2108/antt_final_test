<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Phát hiện chi tiêu BẤT THƯỜNG (anomaly detection).
 *
 * Ba loại bất thường:
 *   1) Giao dịch ngoại lai trong từng danh mục — dùng MODIFIED Z-SCORE
 *      (median / MAD). MAD bền với chính outlier nên không bị một khoản lớn
 *      làm "lố" như độ lệch chuẩn thường.  modz = 0.6745*(x - median)/MAD
 *      Cờ khi modz > 3.5 và khoản chi >= ngưỡng tối thiểu.
 *   2) Tổng chi tháng hiện tại tăng đột biến so với trung bình các tháng trước.
 *   3) Vượt ngân sách danh mục trong tháng.
 *
 * Trả về mảng các anomaly: [kind, severity, title, body, data].
 * Không ghi DB — việc lưu insight / gửi notification do controller quyết định.
 */
class SpendingAnomalyService
{
    private const MIN_SAMPLES = 5;
    private const MODZ_THRESHOLD = 3.5;
    private const MIN_OUTLIER_AMOUNT = 1000000; // 1 triệu VND
    private const SPIKE_RATIO = 1.5;

    public function detect(int $userId): array
    {
        $anomalies = [];

        $rows = DB::table('records')
            ->join('categories', 'categories.id', '=', 'records.category_id')
            ->where('records.user_id', $userId)
            ->where('records.type', 'expense')
            ->whereNull('records.deleted_at')
            ->get(['records.id', 'records.category_id', 'categories.name as cat', 'records.name as rname', 'records.amount']);

        // Gom theo danh mục
        $byCat = [];
        foreach ($rows as $r) {
            $byCat[$r->category_id]['name'] = $r->cat;
            $byCat[$r->category_id]['items'][] = $r;
        }

        // (1) Ngoại lai theo modified z-score
        foreach ($byCat as $info) {
            $amts = array_map(fn ($x) => abs((float) $x->amount), $info['items']);
            if (count($amts) < self::MIN_SAMPLES) {
                continue;
            }
            $med = $this->median($amts);
            $mad = $this->mad($amts, $med);
            if ($mad <= 0) {
                continue;
            }
            $best = null;
            foreach ($info['items'] as $it) {
                $a = abs((float) $it->amount);
                $modz = 0.6745 * ($a - $med) / $mad;
                if ($modz > self::MODZ_THRESHOLD && $a >= self::MIN_OUTLIER_AMOUNT) {
                    if ($best === null || $modz > $best['modz']) {
                        $best = ['it' => $it, 'a' => $a, 'modz' => $modz];
                    }
                }
            }
            if ($best !== null) {
                $anomalies[] = [
                    'kind' => 'outlier',
                    'severity' => $best['modz'] > 8 ? 'high' : 'warning',
                    'title' => 'Chi tiêu bất thường: ' . $best['it']->rname,
                    'body' => sprintf(
                        'Khoản %sđ cho "%s" cao bất thường so với mức điển hình ~%sđ (điểm lệch %.1f).',
                        number_format($best['a']),
                        $info['name'],
                        number_format($med),
                        $best['modz'],
                    ),
                    'data' => [
                        'record_id' => $best['it']->id,
                        'category' => $info['name'],
                        'amount' => $best['a'],
                        'mod_z' => round($best['modz'], 2),
                    ],
                ];
            }
        }

        // (2) Tăng đột biến tổng chi tháng
        $monthly = DB::table('records')
            ->where('user_id', $userId)
            ->where('type', 'expense')
            ->whereNull('deleted_at')
            ->selectRaw("strftime('%Y-%m', date) as ym, SUM(ABS(amount)) as total")
            ->groupBy('ym')
            ->orderBy('ym')
            ->get();

        $curMonth = now()->format('Y-m');
        $prev = [];
        $curTotal = 0.0;
        foreach ($monthly as $m) {
            if ($m->ym === $curMonth) {
                $curTotal = (float) $m->total;
            } else {
                $prev[] = (float) $m->total;
            }
        }
        if (count($prev) > 0) {
            $avg = array_sum($prev) / count($prev);
            if ($avg > 0 && $curTotal > $avg * self::SPIKE_RATIO) {
                $anomalies[] = [
                    'kind' => 'monthly_spike',
                    'severity' => 'warning',
                    'title' => 'Tổng chi tháng này tăng mạnh',
                    'body' => sprintf(
                        'Tháng này đã chi %sđ — cao hơn ~%.1f lần trung bình (%sđ).',
                        number_format($curTotal),
                        $curTotal / $avg,
                        number_format($avg),
                    ),
                    'data' => ['this_month' => $curTotal, 'avg' => $avg],
                ];
            }
        }

        // (3) Vượt ngân sách danh mục (tháng hiện tại)
        $budgets = DB::table('budgets')
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->get(['category_id', 'amount']);
        foreach ($budgets as $b) {
            $spent = (float) DB::table('records')
                ->where('user_id', $userId)
                ->where('type', 'expense')
                ->where('category_id', $b->category_id)
                ->whereNull('deleted_at')
                ->whereRaw("strftime('%Y-%m', date) = ?", [$curMonth])
                ->sum(DB::raw('ABS(amount)'));
            $bud = (float) $b->amount;
            if ($bud > 0 && $spent > $bud) {
                $cname = DB::table('categories')->where('id', $b->category_id)->value('name');
                $pct = $spent / $bud * 100;
                $anomalies[] = [
                    'kind' => 'budget_overspend',
                    'severity' => $pct > 120 ? 'high' : 'warning',
                    'title' => 'Vượt ngân sách: ' . $cname,
                    'body' => sprintf('Đã chi %sđ / ngân sách %sđ (%d%%).', number_format($spent), number_format($bud), (int) round($pct)),
                    'data' => ['category' => $cname, 'spent' => $spent, 'budget' => $bud, 'pct' => (int) round($pct)],
                ];
            }
        }

        return array_slice($anomalies, 0, 10);
    }

    private function median(array $xs): float
    {
        sort($xs);
        $n = count($xs);
        if ($n === 0) {
            return 0.0;
        }
        $mid = intdiv($n, 2);
        return $n % 2 ? (float) $xs[$mid] : ($xs[$mid - 1] + $xs[$mid]) / 2.0;
    }

    private function mad(array $xs, float $median): float
    {
        $dev = array_map(fn ($x) => abs($x - $median), $xs);
        return $this->median($dev);
    }
}
