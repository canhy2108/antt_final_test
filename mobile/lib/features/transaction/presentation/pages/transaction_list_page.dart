import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/models/transaction_model.dart';
import '../../../../core/router/app_router.dart';
import '../../../transaction/data/transaction_repository.dart';

// Providers for filter state
final _typeFilterProvider = StateProvider.autoDispose<String?>((ref) => null);
final _searchProvider = StateProvider.autoDispose<String?>((ref) => null);
final _pageProvider = StateProvider.autoDispose<int>((ref) => 1);

final filteredTransactionsProvider = FutureProvider.autoDispose<List<TransactionModel>>((ref) {
  final type = ref.watch(_typeFilterProvider);
  final search = ref.watch(_searchProvider);
  final page = ref.watch(_pageProvider);
  return ref.read(transactionRepoProvider).getAll(page: page, type: type, search: search);
});

class TransactionListPage extends ConsumerStatefulWidget {
  const TransactionListPage({super.key});
  @override
  ConsumerState<TransactionListPage> createState() => _TransactionListPageState();
}

class _TransactionListPageState extends ConsumerState<TransactionListPage> {
  final _searchCtrl = TextEditingController();
  bool _showSearch = false;

  final _filters = [
    (null, 'Tất cả'),
    ('expense', 'Chi tiêu'),
    ('income', 'Thu nhập'),
    ('transfer', 'Chuyển khoản'),
  ];

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final currentType = ref.watch(_typeFilterProvider);
    final txAsync = ref.watch(filteredTransactionsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(child: Column(children: [
        // ── App bar ──────────────────────────────────────────────────
        Padding(padding: const EdgeInsets.fromLTRB(20, 16, 20, 0), child: Row(children: [
          if (_showSearch) Expanded(child: TextField(
            controller: _searchCtrl,
            autofocus: true,
            style: AppTextStyles.bodyL,
            decoration: InputDecoration(
              hintText: 'Tìm giao dịch...',
              prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textSecondary),
              suffixIcon: IconButton(icon: const Icon(Icons.close_rounded), onPressed: () {
                setState(() => _showSearch = false);
                _searchCtrl.clear();
                ref.read(_searchProvider.notifier).state = null;
              }),
              filled: true, fillColor: AppColors.surface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(99), borderSide: BorderSide.none),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            onChanged: (v) => ref.read(_searchProvider.notifier).state = v.isEmpty ? null : v,
          )) else ...[
            Text('Giao dịch', style: AppTextStyles.headingXL),
            const Spacer(),
            GestureDetector(onTap: () => setState(() => _showSearch = true),
              child: Container(width: 44, height: 44,
                decoration: BoxDecoration(color: AppColors.surface, shape: BoxShape.circle, boxShadow: AppTheme.shadowS),
                child: const Icon(Icons.search_rounded, size: 22))),
            const SizedBox(width: 8),
            GestureDetector(onTap: () => context.push(AppRoutes.transactionAdd),
              child: Container(width: 44, height: 44,
                decoration: BoxDecoration(color: AppColors.dark, shape: BoxShape.circle, boxShadow: AppTheme.shadowL),
                child: const Icon(Icons.add_rounded, color: Colors.white, size: 22))),
          ],
        ])),
        const SizedBox(height: 16),

        // ── Filter chips ─────────────────────────────────────────────
        SizedBox(height: 40, child: ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          itemCount: _filters.length,
          itemBuilder: (_, i) {
            final (type, label) = _filters[i];
            final active = currentType == type;
            return Padding(padding: const EdgeInsets.only(right: 8), child: GestureDetector(
              onTap: () { HapticFeedback.selectionClick(); ref.read(_typeFilterProvider.notifier).state = type; },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: active ? AppColors.dark : AppColors.surface,
                  borderRadius: BorderRadius.circular(99),
                  boxShadow: active ? AppTheme.shadowL : AppTheme.shadowS,
                ),
                child: Text(label, style: AppTextStyles.labelM.copyWith(
                    color: active ? AppColors.primary : AppColors.textPrimary)),
              ),
            ));
          },
        )),
        const SizedBox(height: 16),

        // ── Transaction list ─────────────────────────────────────────
        Expanded(child: txAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
          error: (_, __) => Center(child: Text('Lỗi tải dữ liệu', style: AppTextStyles.bodyS)),
          data: (txList) => txList.isEmpty
            ? _EmptyState()
            : ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: txList.length,
                itemBuilder: (_, i) {
                  // Group by date
                  final tx = txList[i];
                  final showDate = i == 0 || !_sameDay(txList[i-1].date, tx.date);
                  return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (showDate) ...[
                      if (i > 0) const SizedBox(height: 8),
                      Padding(padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Text(_formatDate(tx.date), style: AppTextStyles.labelM)),
                    ],
                    _TxCard(tx: tx, onDelete: () async {
                      await ref.read(transactionRepoProvider).delete(tx.id);
                      ref.invalidate(filteredTransactionsProvider);
                    }),
                    const SizedBox(height: 8),
                  ]);
                },
              ),
        )),
      ])),
    );
  }

  bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    if (_sameDay(date, now)) return 'Hôm nay';
    if (_sameDay(date, now.subtract(const Duration(days: 1)))) return 'Hôm qua';
    return DateFormat('EEEE, dd/MM/yyyy', 'vi').format(date);
  }
}

class _TxCard extends StatelessWidget {
  final TransactionModel tx;
  final VoidCallback onDelete;
  const _TxCard({required this.tx, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final isIncome = tx.type == TransactionType.income;
    final color = isIncome ? AppColors.income : AppColors.expense;
    final sign = isIncome ? '+' : '-';
    final fmt = NumberFormat.currency(locale: 'vi_VN', symbol: '₫');

    return Dismissible(
      key: Key(tx.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight, padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(color: AppColors.expense, borderRadius: BorderRadius.circular(AppTheme.radiusL)),
        child: const Icon(Icons.delete_outline_rounded, color: Colors.white, size: 24),
      ),
      confirmDismiss: (_) async { onDelete(); return false; },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface, borderRadius: BorderRadius.circular(AppTheme.radiusL), boxShadow: AppTheme.shadowS),
        child: Row(children: [
          Container(width: 44, height: 44,
            decoration: BoxDecoration(color: tx.categoryColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(AppTheme.radiusM)),
            child: Icon(Icons.category_rounded, color: tx.categoryColor, size: 22)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tx.name.isEmpty ? tx.categoryName : tx.name,
                style: AppTextStyles.headingS, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 2),
            Text(tx.categoryName, style: AppTextStyles.bodyS),
          ])),
          Text('$sign${fmt.format(tx.amount)}',
              style: AppTextStyles.moneyS.copyWith(color: color)),
        ]),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    Container(width: 80, height: 80, decoration: const BoxDecoration(color: AppColors.grey100, shape: BoxShape.circle),
      child: const Icon(Icons.receipt_long_outlined, size: 40, color: AppColors.grey400)),
    const SizedBox(height: 16),
    Text('Không tìm thấy giao dịch', style: AppTextStyles.headingM),
    const SizedBox(height: 8),
    Text('Thử thay đổi bộ lọc hoặc thêm giao dịch mới', style: AppTextStyles.bodyS, textAlign: TextAlign.center),
  ]));
}

