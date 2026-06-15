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
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

/**
 * Bộ dữ liệu test cho VÀI tài khoản.
 *
 * Mỗi tài khoản test có DANH MỤC RIÊNG (parent + sub gắn user_id), tài khoản
 * tiền, giao dịch (thu/chi/chuyển khoản 6 tháng gần đây), ngân sách và khoản
 * sắp chi — đủ để test toàn bộ tính năng.
 *
 * Chạy:
 *   php artisan migrate --seed          # tạo account_types + currencies (1 lần)
 *   php artisan db:seed --class=TestAccountsSeeder
 *
 * Đăng nhập (mật khẩu: Demo@Bee2026):
 *   an@budgetbee.com · binh@budgetbee.com · cuong@budgetbee.com
 */
class TestAccountsSeeder extends Seeder
{
    private const PASSWORD = 'Demo@Bee2026';

    public function run(): void
    {
        $profiles = [
            ['email' => 'an@budgetbee.com',    'name' => 'Nguyễn Văn An',  'accounts' => 4, 'records' => 150, 'budgets' => 6, 'upcoming' => 4],
            ['email' => 'binh@budgetbee.com',  'name' => 'Trần Thị Bình',  'accounts' => 3, 'records' => 100, 'budgets' => 5, 'upcoming' => 3],
            ['email' => 'cuong@budgetbee.com', 'name' => 'Lê Hùng Cường',  'accounts' => 5, 'records' => 220, 'budgets' => 8, 'upcoming' => 5],
        ];

        $accountTypes = AccountTypes::all();
        if ($accountTypes->isEmpty()) {
            $this->command->warn('⚠️  Chưa có account_types. Chạy "php artisan migrate --seed" trước.');
            return;
        }
        $currencies = DB::table('currencies')->limit(3)->get();
        if ($currencies->isEmpty()) {
            $this->command->warn('⚠️  Chưa có currencies. Chạy "php artisan migrate --seed" trước.');
            return;
        }

        $catPath = database_path('seeders/data/categories.json');
        $catData = json_decode(file_get_contents($catPath), true);

        foreach ($profiles as $p) {
            if (User::where('email', $p['email'])->exists()) {
                $this->command->warn("↷ {$p['email']} đã tồn tại — bỏ qua (xoá user này nếu muốn tạo lại).");
                continue;
            }
            DB::transaction(function () use ($p, $catData, $accountTypes, $currencies) {
                $this->seedUser($p, $catData, $accountTypes, $currencies);
            });
            $this->command->info("✓ {$p['name']} <{$p['email']}> — {$p['accounts']} tài khoản, {$p['records']} giao dịch.");
        }

        $this->command->newLine();
        $this->command->info('🔑 Đăng nhập test (mật khẩu: ' . self::PASSWORD . '):');
        $this->command->info('   an@budgetbee.com · binh@budgetbee.com · cuong@budgetbee.com');
    }

    private function seedUser(array $p, array $catData, $accountTypes, $currencies): void
    {
        $user = User::create([
            'name' => $p['name'],
            'email' => $p['email'],
            'password' => Hash::make(self::PASSWORD),
            'email_verified_at' => now(),
        ]);

        // Tiền tệ của user
        foreach ($currencies as $c) {
            UserCurrency::firstOrCreate(['user_id' => $user->id, 'currency_id' => $c->id]);
        }
        $userCurrencies = UserCurrency::where('user_id', $user->id)->get();
        $user->update(['currency_id' => $userCurrencies->first()->id]);

        // Danh mục RIÊNG cho user (parent + sub, id tự sinh)
        $expenseCatIds = [];
        $incomeCatIds = [];
        $transferCatId = null;

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
                }
            }
        }

        // Tài khoản tiền
        $accountNames = ['Tài khoản chính', 'Thẻ tín dụng', 'Tiết kiệm', 'Ví tiền mặt', 'Ví điện tử', 'Quỹ dự phòng', 'Đầu tư'];
        $colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
        $accounts = [];
        for ($i = 0; $i < (int) $p['accounts']; $i++) {
            $accounts[] = Account::create([
                'user_id' => $user->id,
                'name' => $accountNames[$i % count($accountNames)],
                'type_id' => $accountTypes->random()->id,
                'color' => $colors[$i % count($colors)],
                'initial_balance' => rand(500000, 50000000), // VND
                'currency_id' => $userCurrencies->random()->id,
            ]);
        }

        // Ngân sách (theo danh mục chi tiêu)
        $budgetCats = $expenseCatIds;
        shuffle($budgetCats);
        foreach (array_slice($budgetCats, 0, (int) $p['budgets']) as $catId) {
            Budget::create([
                'user_id' => $user->id,
                'category_id' => $catId,
                'amount' => rand(500000, 8000000),
            ]);
        }

        // Giao dịch (thu / chi / chuyển khoản) trong 6 tháng gần đây
        Record::disableAiControllerProcessing();
        $incomeNames = ['Lương tháng', 'Thưởng', 'Freelance', 'Bán đồ cũ', 'Hoàn tiền', 'Lãi tiết kiệm'];
        $expenseNames = ['Siêu thị', 'Nhà hàng', 'Cà phê', 'Xăng xe', 'Hoá đơn điện nước', 'Mua sắm online', 'Gym', 'Thuốc', 'Grab', 'Netflix'];

        for ($i = 0; $i < (int) $p['records']; $i++) {
            $date = Carbon::now()->subDays(rand(0, 180))->format('Y-m-d');
            $from = $accounts[array_rand($accounts)];
            $roll = rand(1, 100);

            if ($roll <= 60 && !empty($expenseCatIds)) {
                // chi
                Record::create([
                    'user_id' => $user->id,
                    'date' => $date,
                    'from_account_id' => $from->id,
                    'type' => 'expense',
                    'category_id' => $expenseCatIds[array_rand($expenseCatIds)],
                    'name' => $expenseNames[array_rand($expenseNames)],
                    'amount' => -rand(20000, 2000000),
                    'rate' => 1,
                ]);
            } elseif ($roll <= 85 && !empty($incomeCatIds)) {
                // thu
                Record::create([
                    'user_id' => $user->id,
                    'date' => $date,
                    'from_account_id' => $from->id,
                    'type' => 'income',
                    'category_id' => $incomeCatIds[array_rand($incomeCatIds)],
                    'name' => $incomeNames[array_rand($incomeNames)],
                    'amount' => rand(2000000, 30000000),
                    'rate' => 1,
                ]);
            } elseif (count($accounts) >= 2 && $transferCatId !== null) {
                // chuyển khoản
                $to = $accounts[array_rand($accounts)];
                while ($to->id === $from->id) {
                    $to = $accounts[array_rand($accounts)];
                }
                Record::create([
                    'user_id' => $user->id,
                    'date' => $date,
                    'from_account_id' => $from->id,
                    'to_account_id' => $to->id,
                    'type' => 'transfer',
                    'category_id' => $transferCatId,
                    'name' => 'Chuyển khoản nội bộ',
                    'amount' => rand(200000, 5000000),
                    'rate' => 1,
                ]);
            }
        }
        Record::enableAiControllerProcessing();

        // Khoản sắp chi (category_id NOT NULL → luôn gắn danh mục chi tiêu)
        $upcomingTitles = ['Bảo hiểm năm', 'Gia hạn tên miền', 'Du lịch hè', 'Học phí', 'Bảo dưỡng xe', 'Đăng ký năm'];
        if (!empty($expenseCatIds)) {
            for ($i = 0; $i < (int) $p['upcoming']; $i++) {
                UpcomingExpense::create([
                    'user_id' => $user->id,
                    'title' => $upcomingTitles[$i % count($upcomingTitles)],
                    'category_id' => $expenseCatIds[array_rand($expenseCatIds)],
                    'amount' => rand(1000000, 15000000),
                    'due_date' => Carbon::now()->addMonths(rand(1, 12))->format('Y-m-d'),
                ]);
            }
        }
    }
}
