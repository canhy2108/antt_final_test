import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/models/transaction_model.dart';
import '../../../transaction/data/transaction_repository.dart';

class RecentTransactions extends ConsumerWidget {
  final bool privacyMode;
  const RecentTransactions({super.key, this.privacyMode = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final txAsync = ref.watch(recentTransactionsProvider);
    return txAsync.when(
      loading: () => _SkeletonList(),
      error: (_, __) => Center(child: Text('Không tải được dữ liệu', style: AppTextStyles.bodyS)),
      data: (txList) => txList.isEmpty
        ? _EmptyState()
        : Column(children: txList.take(5).map((tx) =>
            _TxItem(tx: tx, privacyMode: privacyMode,
              onDelete: () => _confirmDelete(context, ref, tx),
            )).toList()),
    );
  }

  Future<void> _confirmDelete(BuildContext ctx, WidgetRef ref, TransactionModel tx) async {
    HapticFeedback.mediumImpact();
    final confirmed = await showDialog<bool>(
      context: ctx,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusL)),
        title: Text('Xoá giao dịch?', style: AppTextStyles.headingM),
        content: Text('Xoá "${tx.name}" không thể hoàn tác.', style: AppTextStyles.bodyM),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.expense, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true), child: const Text('Xoá')),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(transactionRepoProvider).delete(tx.id);
      ref.invalidate(recentTransactionsProvider);
    }
  }
}

class _TxItem extends StatelessWidget {
  final TransactionModel tx;
  final bool privacyMode;
  final VoidCallback onDelete;
  const _TxItem({required this.tx, required this.privacyMode, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final isIncome = tx.type == TransactionType.income;
    final color = isIncome ? AppColors.income : AppColors.expense;
    final sign = isIncome ? '+' : '-';
    final fmt = NumberFormat.compactCurrency(locale: 'vi_VN', symbol: '');

    return Dismissible(
      key: Key(tx.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: AppColors.expense, borderRadius: BorderRadius.circular(AppTheme.radiusL)),
        child: const Icon(Icons.delete_outline_rounded, color: Colors.white, size: 24),
      ),
      confirmDismiss: (_) async { onDelete(); return false; },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusL),
          boxShadow: AppTheme.shadowS,
        ),
        child: Row(children: [
          // Category icon
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: tx.categoryColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(AppTheme.radiusM),
            ),
            child: Icon(Icons.category_rounded, color: tx.categoryColor, size: 22),
          ),
          const SizedBox(width: 12),
          // Name + category
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tx.name.isEmpty ? tx.categoryName : tx.name,
                style: AppTextStyles.headingS, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 2),
            Text(
              '${tx.categoryName} • ${DateFormat('dd MMM', 'vi').format(tx.date)}',
              style: AppTextStyles.bodyS,
            ),
          ])),
          const SizedBox(width: 8),
          // Amount
          Text(
            privacyMode ? '••••' : '$sign${fmt.format(tx.amount)} ₫',
            style: AppTextStyles.moneyS.copyWith(color: color),
          ),
        ]),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 72, height: 72,
          decoration: const BoxDecoration(color: AppColors.grey100, shape: BoxShape.circle),
          child: const Icon(Icons.receipt_long_outlined, size: 36, color: AppColors.grey400)),
        const SizedBox(height: 12),
        Text('Chưa có giao dịch nào', style: AppTextStyles.headingS),
        const SizedBox(height: 4),
        Text('Bấm + để thêm giao dịch đầu tiên', style: AppTextStyles.bodyS),
      ]),
    ));
  }
}

class _SkeletonList extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(children: List.generate(4, (_) => Container(
      height: 70, margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(AppTheme.radiusL)),
    )));
  }
}
