<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Account;
use App\Models\Category;
use App\Models\ParentCategory;
use App\Models\UserCurrency;
use App\Models\Budget;
use App\Models\Record;
use App\Models\UpcomingExpense;
use App\Models\AccountTypes;
use App\Models\SavingsGoal;
use App\Models\SavingsGoalContribution;
use App\Models\DebtLoan;
use App\Models\DebtSettlement;
use App\Models\RecurringTransaction;
use App\Models\Notification;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

/**
 * MỘT tài khoản test ĐẦY ĐỦ mọi tính năng:
 *   tài khoản tiền · danh mục · giao dịch · ngân sách · khoản sắp chi ·
 *   mục tiêu tiết kiệm (+ lần góp) · nợ/cho vay (+ thanh toán) ·
 *   giao dịch định kỳ · thông báo.
 *
 * Chạy:
 *   php artisan migrate --seed                              # 1 lần
 *   php artisan db:seed --class=TestFullAccountSeeder
 *
 * Đăng nhập:  demo@budgetbee.com  /  Demo@Bee2026
 */
class TestFullAccountSeeder extends Seeder
{
    private const EMAIL = 'demo@budgetbee.com';
    private const PASSWORD = 'Demo@Bee2026';

    public function run(): void
    {
        $accountTypes = AccountTypes::all();
        $currencies = DB::table('currencies')->limit(3)->get();
        if ($accountTypes->isEmpty() || $currencies->isEmpty()) {
            $this->command->warn('⚠️  Thiếu account_types / currencies. Chạy "php artisan migrate --seed" trước.');
            return;
        }

        if (User::where('email', self::EMAIL)->exists()) {
            $this->command->warn('↷ ' . self::EMAIL . ' đã tồn tại — xoá user này rồi chạy lại nếu muốn tạo mới.');
            return;
        }

        $catData = json_decode(file_get_contents(database_path('seeders/data/categories.json')), true);

        DB::transaction(function () use ($catData, $accountTypes, $currencies) {
            $this->seed($catData, $accountTypes, $currencies);
        });

        $this->command->newLine();
        $this->command->info('✅ Tạo xong tài khoản test đầy đủ.');
        $this->command->info('🔑 Đăng nhập:  ' . self::EMAIL . '  /  ' . self::PASSWORD);
    }

    private function seed(array $catData, $accountTypes, $currencies): void
    {
        // ---- User ----
        $user = User::create([
            'name' => 'Demo Đầy Đủ',
            'email' => self::EMAIL,
            'password' => Hash::make(self::PASSWORD),
            'email_verified_at' => now(),
        ]);

        foreach ($currencies as $c) {
            UserCurrency::firstOrCreate(['user_id' => $user->id, 'currency_id' => $c->id]);
        }
        $userCurrencies = UserCurrency::where('user_id', $user->id)->get();
        $user->update(['currency_id' => $userCurrencies->first()->id]);

        // ---- Danh mục riêng ----
        $expenseCatIds = [];
        $incomeCatIds = [];
        $transferCatId = null;
        $rentCatId = null;
        foreach ($catData as $parent) {
            $pc = ParentCategory::create([
                'user_id' => $user->id,
                'name' => $parent['name'],
                'color' => $parent['color'],
                'icon' => $parent['icon'],
            ]);
            foreach ($parent['categories'] as $sub) {
                $cat = Category::create([
                    'user_id' => $user->id,
                    'name' => $sub['name'],
                    'icon' => $sub['icon'],
                    'parent_category_id' => $pc->id,
                ]);
                if ($parent['name'] === 'Transfer') {
                    $transferCatId = $cat->id;
                } elseif ($parent['name'] === 'Incomes') {
                    $incomeCatIds[] = $cat->id;
                } else {
                    $expenseCatIds[] = $cat->id;
                    if ($sub['name'] === 'Rent') {
                        $rentCatId = $cat->id;
                    }
                }
            }
        }
        $anyExpenseCat = $expenseCatIds[0];
        $anyIncomeCat = $incomeCatIds[0];
        if ($rentCatId === null) {
            $rentCatId = $anyExpenseCat;
        }

        // ---- Tài khoản tiền (5) ----
        $accountNames = ['Tài khoản chính', 'Thẻ tín dụng', 'Tiết kiệm', 'Ví tiền mặt', 'Ví điện tử'];
        $colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
        $accounts = [];
        for ($i = 0; $i < 5; $i++) {
            $accounts[] = Account::create([
                'user_id' => $user->id,
                'name' => $accountNames[$i],
                'type_id' => $accountTypes->random()->id,
                'color' => $colors[$i],
                'initial_balance' => rand(1000000, 60000000),
                'currency_id' => $userCurrencies->first()->id,
            ]);
        }

        // ---- Ngân sách (8) ----
        $budgetCats = $expenseCatIds;
        shuffle($budgetCats);
        foreach (array_slice($budgetCats, 0, 8) as $catId) {
            Budget::create([
                'user_id' => $user->id,
                'category_id' => $catId,
                'amount' => rand(500000, 8000000),
            ]);
        }

        // ---- Giao dịch (180) ----
        Record::disableAiControllerProcessing();
        $incomeNames = ['Lương tháng', 'Thưởng', 'Freelance', 'Bán đồ cũ', 'Hoàn tiền', 'Lãi tiết kiệm'];
        $expenseNames = ['Siêu thị', 'Nhà hàng', 'Cà phê', 'Xăng xe', 'Hoá đơn điện nước', 'Mua sắm online', 'Gym', 'Thuốc', 'Grab', 'Netflix'];
        for ($i = 0; $i < 180; $i++) {
            $date = Carbon::now()->subDays(rand(0, 180))->format('Y-m-d');
            $from = $accounts[array_rand($accounts)];
            $roll = rand(1, 100);
            if ($roll <= 60) {
                Record::create([
                    'user_id' => $user->id, 'date' => $date, 'from_account_id' => $from->id,
                    'type' => 'expense', 'category_id' => $expenseCatIds[array_rand($expenseCatIds)],
                    'name' => $expenseNames[array_rand($expenseNames)], 'amount' => -rand(20000, 2000000), 'rate' => 1,
                ]);
            } elseif ($roll <= 85) {
                Record::create([
                    'user_id' => $user->id, 'date' => $date, 'from_account_id' => $from->id,
                    'type' => 'income', 'category_id' => $incomeCatIds[array_rand($incomeCatIds)],
                    'name' => $incomeNames[array_rand($incomeNames)], 'amount' => rand(2000000, 30000000), 'rate' => 1,
                ]);
            } else {
                $to = $accounts[array_rand($accounts)];
                while ($to->id === $from->id) { $to = $accounts[array_rand($accounts)]; }
                Record::create([
                    'user_id' => $user->id, 'date' => $date, 'from_account_id' => $from->id, 'to_account_id' => $to->id,
                    'type' => 'transfer', 'category_id' => $transferCatId, 'name' => 'Chuyển khoản nội bộ',
                    'amount' => rand(200000, 5000000), 'rate' => 1,
                ]);
            }
        }
        Record::enableAiControllerProcessing();

        // ---- Khoản sắp chi (5) ----
        $upcomingTitles = ['Bảo hiểm năm', 'Gia hạn tên miền', 'Du lịch hè', 'Học phí', 'Bảo dưỡng xe'];
        foreach ($upcomingTitles as $idx => $title) {
            UpcomingExpense::create([
                'user_id' => $user->id, 'title' => $title,
                'category_id' => $expenseCatIds[array_rand($expenseCatIds)],
                'amount' => rand(1000000, 15000000),
                'due_date' => Carbon::now()->addMonths($idx + 1)->format('Y-m-d'),
            ]);
        }

        // ---- Mục tiêu tiết kiệm (3) + lần góp ----
        $savings = [
            ['name' => 'MacBook Pro M4', 'icon' => 'laptop', 'color' => '#45B7D1', 'target' => 45000000, 'current' => 18000000, 'status' => 'active', 'months' => 6],
            ['name' => 'Quỹ khẩn cấp', 'icon' => 'shield', 'color' => '#22C55E', 'target' => 50000000, 'current' => 50000000, 'status' => 'completed', 'months' => 0],
            ['name' => 'Du lịch Nhật Bản', 'icon' => 'airplane', 'color' => '#F59E0B', 'target' => 30000000, 'current' => 8000000, 'status' => 'active', 'months' => 8],
        ];
        foreach ($savings as $sg) {
            $goal = SavingsGoal::create([
                'user_id' => $user->id,
                'name' => $sg['name'],
                'icon' => $sg['icon'],
                'color' => $sg['color'],
                'target_amount' => $sg['target'],
                'current_amount' => $sg['current'],
                'currency' => 'VND',
                'started_at' => Carbon::now()->subMonths(3)->format('Y-m-d'),
                'target_date' => $sg['months'] > 0 ? Carbon::now()->addMonths($sg['months'])->format('Y-m-d') : null,
                'completed_at' => $sg['status'] === 'completed' ? now()->format('Y-m-d') : null,
                'account_id' => $accounts[2]->id,
                'status' => $sg['status'],
            ]);
            // Chia current_amount thành 3 lần góp
            $per = (int) round($sg['current'] / 3);
            for ($k = 0; $k < 3 && $per > 0; $k++) {
                SavingsGoalContribution::create([
                    'goal_id' => $goal->id,
                    'amount' => $per,
                    'contributed_on' => Carbon::now()->subMonths(2 - $k)->format('Y-m-d'),
                    'notes' => 'Góp định kỳ',
                ]);
            }
        }

        // ---- Nợ / cho vay (4) + thanh toán ----
        $debts = [
            ['direction' => 'lent', 'name' => 'Anh Minh', 'phone' => '0901111222', 'principal' => 5000000, 'remaining' => 5000000, 'status' => 'open', 'settle' => 0],
            ['direction' => 'lent', 'name' => 'Chị Hoa', 'phone' => '0903333444', 'principal' => 10000000, 'remaining' => 6000000, 'status' => 'partially_settled', 'settle' => 4000000],
            ['direction' => 'borrowed', 'name' => 'Ngân hàng ABC', 'phone' => null, 'principal' => 20000000, 'remaining' => 20000000, 'status' => 'open', 'settle' => 0],
            ['direction' => 'borrowed', 'name' => 'Bạn Nam', 'phone' => '0905555666', 'principal' => 8000000, 'remaining' => 3000000, 'status' => 'partially_settled', 'settle' => 5000000],
        ];
        foreach ($debts as $d) {
            $debt = DebtLoan::create([
                'user_id' => $user->id,
                'direction' => $d['direction'],
                'counterparty_name' => $d['name'],
                'counterparty_phone' => $d['phone'],
                'principal_amount' => $d['principal'],
                'remaining_amount' => $d['remaining'],
                'currency' => 'VND',
                'interest_rate' => $d['direction'] === 'borrowed' ? 8.5 : 0,
                'interest_type' => $d['direction'] === 'borrowed' ? 'simple' : null,
                'started_at' => Carbon::now()->subMonths(2)->format('Y-m-d'),
                'due_at' => Carbon::now()->addMonths(3)->format('Y-m-d'),
                'status' => $d['status'],
                'notes' => 'Dữ liệu test',
            ]);
            if ($d['settle'] > 0) {
                DebtSettlement::create([
                    'debt_id' => $debt->id,
                    'amount' => $d['settle'],
                    'settled_on' => Carbon::now()->subMonth()->format('Y-m-d'),
                    'notes' => 'Trả một phần',
                ]);
            }
        }

        // ---- Giao dịch định kỳ (4) ----
        $recurring = [
            ['name' => 'Lương tháng', 'type' => 'income', 'amount' => 22000000, 'cat' => $anyIncomeCat, 'days' => 5],
            ['name' => 'Tiền nhà', 'type' => 'expense', 'amount' => 5000000, 'cat' => $rentCatId, 'days' => 3],
            ['name' => 'Netflix', 'type' => 'expense', 'amount' => 260000, 'cat' => $anyExpenseCat, 'days' => 10],
            ['name' => 'Gym', 'type' => 'expense', 'amount' => 600000, 'cat' => $anyExpenseCat, 'days' => 15],
        ];
        foreach ($recurring as $r) {
            RecurringTransaction::create([
                'user_id' => $user->id,
                'name' => $r['name'],
                'type' => $r['type'],
                'amount' => $r['amount'],
                'from_account_id' => $accounts[0]->id,
                'category_id' => $r['cat'],
                'frequency' => 'monthly',
                'interval' => 1,
                'starts_on' => Carbon::now()->subMonths(2)->format('Y-m-d'),
                'next_run_at' => Carbon::now()->addDays($r['days']),
                'run_count' => 2,
                'is_active' => true,
                'auto_create_record' => true,
                'notify_before' => true,
            ]);
        }

        // ---- Thông báo (5) ----
        $notifs = [
            ['type' => 'welcome', 'title' => 'Chào mừng đến BudgetBee 🐝', 'body' => 'Tài khoản demo đã sẵn sàng để test.', 'read' => true],
            ['type' => 'budget_alert', 'title' => 'Cảnh báo ngân sách', 'body' => 'Bạn đã dùng 85% ngân sách "Ăn uống" tháng này.', 'read' => false],
            ['type' => 'upcoming_expense', 'title' => 'Sắp đến hạn chi', 'body' => 'Bảo hiểm năm sẽ đến hạn trong 7 ngày.', 'read' => false],
            ['type' => 'savings_milestone', 'title' => 'Mốc tiết kiệm 🎉', 'body' => 'Mục tiêu "Quỹ khẩn cấp" đã hoàn thành 100%.', 'read' => true],
            ['type' => 'debt_due', 'title' => 'Nhắc nợ', 'body' => 'Khoản vay "Ngân hàng ABC" sắp đến hạn.', 'read' => false],
        ];
        foreach ($notifs as $n) {
            Notification::create([
                'user_id' => $user->id,
                'type' => $n['type'],
                'title' => $n['title'],
                'body' => $n['body'],
                'data' => ['seed' => true],
                'read_at' => $n['read'] ? now() : null,
            ]);
        }
    }
}
