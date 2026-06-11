<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /** GET /api/notification — paginated list for the bell + screen. */
    public function index(Request $request)
    {
        $user = $request->user();
        $limit = min((int) $request->query('limit', 30), 100);
        $unreadOnly = filter_var($request->query('unread_only', false), FILTER_VALIDATE_BOOLEAN);

        $query = Notification::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at');

        if ($unreadOnly) {
            $query->whereNull('read_at');
        }

        return response()->json([
            'items' => $query->limit($limit)->get(),
            'unread_count' => Notification::where('user_id', $user->id)->whereNull('read_at')->count(),
        ]);
    }

    /** Cheap unread-count endpoint for the dashboard bell badge. */
    public function unreadCount(Request $request)
    {
        $count = Notification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();
        return response()->json(['unread_count' => $count]);
    }

    /** POST /api/notification/{id}/read */
    public function markRead(Request $request, $id)
    {
        $notif = Notification::where('user_id', $request->user()->id)->find($id);
        if (!$notif) {
            return response()->json(['message' => 'Not found'], 404);
        }
        $notif->markAsRead();
        return response()->json(['ok' => true]);
    }

    /** POST /api/notification/read-all */
    public function markAllRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
        return response()->json(['ok' => true]);
    }

    /** DELETE /api/notification/{id} */
    public function delete(Request $request, $id)
    {
        $notif = Notification::where('user_id', $request->user()->id)->find($id);
        if (!$notif) {
            return response()->json(['message' => 'Not found'], 404);
        }
        $notif->delete();
        return response()->json(['ok' => true]);
    }

    /**
     * Seed a "welcome" notification on first login — kept here as a helper
     * the AuthController can call after a successful self-registration.
     */
    public static function seedWelcome(int $userId, string $userName): void
    {
        Notification::create([
            'user_id' => $userId,
            'type' => 'welcome',
            'title' => 'Chào mừng đến với BudgetBee!',
            'body' => "Xin chào {$userName}, hãy bắt đầu bằng cách thêm tài khoản ngân hàng đầu tiên của bạn.",
            'data' => ['action' => 'open_add_account'],
        ]);
    }

    /** Helper — drop a low-balance alert from anywhere in the codebase. */
    public static function lowBalance(int $userId, float $balance, ?string $currency = '₫'): void
    {
        Notification::create([
            'user_id' => $userId,
            'type' => 'low_balance',
            'title' => 'Số dư thấp',
            'body' => "Tài khoản của bạn còn " . number_format($balance, 0, ',', '.') . " {$currency}",
            'data' => ['balance' => $balance],
        ]);
    }
}
