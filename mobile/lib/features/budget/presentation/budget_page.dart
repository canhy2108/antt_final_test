import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';

// ── Model ────────────────────────────────────────────────────────────────────
class BudgetItem {
  final String id;
  final String name;
  final IconData icon;
  final Color color;
  final double spent;
  final double limit;

  const BudgetItem({
    required this.id, required this.name, required this.icon,
    required this.color, required this.spent, required this.limit,
  });

  double get progress => limit == 0 ? 0 : (spent / limit).clamp(0.0, 1.0);
  bool get isOverBudget => spent > limit;
  bool get isNearLimit => progress >= 0.8 && !isOverBudget;
}

// Mock provider — replace with actual repo
final budgetsProvider = Provider<List<BudgetItem>>((_) => [
  BudgetItem(id: '1', name: 'Ăn uống', icon: Icons.restaurant_rounded,
    color: const Color(0xFFEF4444), spent: 3500000, limit: 5000000),
  BudgetItem(id: '2', name: 'Di chuyển', icon: Icons.directions_car_rounded,
    color: const Color(0xFF3B82F6), spent: 1800000, limit: 2000000),
  BudgetItem(id: '3', name: 'Giải trí', icon: Icons.movie_rounded,
    color: const Color(0xFFEC4899), spent: 600000, limit: 1500000),
  BudgetItem(id: '4', name: 'Mua sắm', icon: Icons.shopping_bag_rounded,
    color: const Color(0xFFF59E0B), spent: 2200000, limit: 2000000),
]);

class BudgetPage extends ConsumerWidget {
  const BudgetPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final budgets = ref.watch(budgetsProvider);
    final totalSpent = budgets.fold<double>(0, (sum, b) => sum + b.spent);
    final totalLimit = budgets.fold<double>(0, (sum, b) => sum + b.limit);
    final overall = totalLimit == 0 ? 0.0 : (totalSpent / totalLimit).clamp(0.0, 1.0);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── Header ────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Row(
                  children: [
                    Text('Ngân sách', style: AppTextStyles.headingXL),
                    const Spacer(),
                    GestureDetector(
                      onTap: () {
                        HapticFeedback.mediumImpact();
                        _showCreateBudget(context);
                      },
                      child: Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.dark, shape: BoxShape.circle,
                          boxShadow: AppTheme.shadowL,
                        ),
                        child: const Icon(Icons.add_rounded, color: Colors.white, size: 22),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 20)),

            // ── Overall budget card ─────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _OverallCard(
                  spent: totalSpent,
                  limit: totalLimit,
                  progress: overall,
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),

            // ── Section header ──────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    Text('Theo danh mục', style: AppTextStyles.headingM),
                    const Spacer(),
                    Text(
                      '${budgets.length} ngân sách',
                      style: AppTextStyles.labelM,
                    ),
                  ],
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 12)),

            // ── Budget list ─────────────────────────────────────────
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _BudgetCard(item: budgets[i]),
                  ),
                  childCount: budgets.length,
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }

  void _showCreateBudget(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CreateBudgetSheet(),
    );
  }
}

// ── Overall budget card ───────────────────────────────────────────────────────
class _OverallCard extends StatelessWidget {
  final double spent, limit, progress;
  const _OverallCard({required this.spent, required this.limit, required this.progress});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.compactCurrency(locale: 'vi_VN', symbol: '');
    final remaining = limit - spent;
    final isOver = spent > limit;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: isOver
            ? [const Color(0xFFEF4444), const Color(0xFFDC2626)]
            : [AppColors.gradientStart, AppColors.gradientEnd],
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusXL),
        boxShadow: [
          BoxShadow(
            color: (isOver ? AppColors.expense : AppColors.primary).withValues(alpha: 0.35),
            blurRadius: 20, offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Tổng chi tiêu tháng này',
                  style: AppTextStyles.bodyM.copyWith(
                      color: isOver ? Colors.white70 : AppColors.dark.withValues(alpha: 0.7))),
              const Spacer(),
              if (isOver)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                  ),
                  child: const Text('⚠️ Vượt mức',
                      style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${fmt.format(spent)} ₫',
            style: AppTextStyles.moneyXL.copyWith(
                color: isOver ? Colors.white : AppColors.dark),
          ),
          const SizedBox(height: 4),
          Text(
            isOver
              ? 'Vượt ${fmt.format(spent - limit)} ₫ so với ngân sách'
              : 'Còn lại ${fmt.format(remaining)} ₫ / ${fmt.format(limit)} ₫',
            style: AppTextStyles.bodyS.copyWith(
                color: isOver ? Colors.white70 : AppColors.dark.withValues(alpha: 0.7)),
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppTheme.radiusFull),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: (isOver ? Colors.white : AppColors.dark).withValues(alpha: 0.2),
              valueColor: AlwaysStoppedAnimation(
                isOver ? Colors.white : AppColors.dark,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Single Budget Card ────────────────────────────────────────────────────────
class _BudgetCard extends StatelessWidget {
  final BudgetItem item;
  const _BudgetCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.compactCurrency(locale: 'vi_VN', symbol: '');
    final progressColor = item.isOverBudget
      ? AppColors.expense
      : item.isNearLimit ? AppColors.warning : item.color;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusL),
        boxShadow: AppTheme.shadowS,
        border: item.isOverBudget
          ? Border.all(color: AppColors.expense.withValues(alpha: 0.3), width: 1.5)
          : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44, height: 44,
                decoration: BoxDecoration(
                  color: item.color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(AppTheme.radiusM),
                ),
                child: Icon(item.icon, color: item.color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.name, style: AppTextStyles.headingS),
                    const SizedBox(height: 2),
                    Text(
                      '${fmt.format(item.spent)} / ${fmt.format(item.limit)} ₫',
                      style: AppTextStyles.bodyS,
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${(item.progress * 100).toInt()}%',
                    style: AppTextStyles.headingM.copyWith(color: progressColor),
                  ),
                  if (item.isOverBudget)
                    Text('Vượt mức',
                        style: AppTextStyles.caption.copyWith(
                            color: AppColors.expense, fontWeight: FontWeight.w700))
                  else if (item.isNearLimit)
                    Text('Sắp hết',
                        style: AppTextStyles.caption.copyWith(
                            color: AppColors.warning, fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppTheme.radiusFull),
            child: LinearProgressIndicator(
              value: item.progress,
              minHeight: 6,
              backgroundColor: AppColors.grey200,
              valueColor: AlwaysStoppedAnimation(progressColor),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Create Budget Bottom Sheet ────────────────────────────────────────────────
class _CreateBudgetSheet extends StatefulWidget {
  @override
  State<_CreateBudgetSheet> createState() => _CreateBudgetSheetState();
}

class _CreateBudgetSheetState extends State<_CreateBudgetSheet> {
  final _amountCtrl = TextEditingController();
  String _selectedCategory = 'Ăn uống';

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20, right: 20, top: 16,
      ),
      decoration: const BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXL)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: AppColors.grey200,
                borderRadius: BorderRadius.circular(AppTheme.radiusFull),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text('Tạo ngân sách mới', style: AppTextStyles.headingL),
          const SizedBox(height: 4),
          Text('Đặt giới hạn chi tiêu để kiểm soát tốt hơn',
              style: AppTextStyles.bodyS),
          const SizedBox(height: 24),

          // Amount input
          Text('Số tiền giới hạn', style: AppTextStyles.labelL),
          const SizedBox(height: 8),
          TextField(
            controller: _amountCtrl,
            keyboardType: TextInputType.number,
            style: AppTextStyles.moneyL,
            decoration: InputDecoration(
              hintText: '0',
              prefixIcon: const Padding(
                padding: EdgeInsets.all(16),
                child: Text('₫', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
              ),
              filled: true, fillColor: AppColors.surface,
            ),
          ),
          const SizedBox(height: 20),

          // Category
          Text('Danh mục', style: AppTextStyles.labelL),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppTheme.radiusM),
            ),
            child: Row(
              children: [
                Container(
                  width: 32, height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.expense.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.restaurant_rounded,
                      color: AppColors.expense, size: 18),
                ),
                const SizedBox(width: 12),
                Text(_selectedCategory, style: AppTextStyles.bodyL),
                const Spacer(),
                const Icon(Icons.chevron_right_rounded,
                    color: AppColors.grey400),
              ],
            ),
          ),
          const SizedBox(height: 32),

          ElevatedButton(
            onPressed: () {
              if (_amountCtrl.text.isNotEmpty) {
                HapticFeedback.mediumImpact();
                Navigator.pop(context);
              }
            },
            child: const Text('Tạo ngân sách'),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
