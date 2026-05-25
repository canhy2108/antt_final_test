import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../transaction/data/transaction_repository.dart';

class QuickStatsRow extends ConsumerWidget {
  final bool privacyMode;
  const QuickStatsRow({super.key, this.privacyMode = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(monthStatsProvider);

    return statsAsync.when(
      loading: () => Row(children: [
        Expanded(child: _SkeletonCard()),
        const SizedBox(width: 12),
        Expanded(child: _SkeletonCard()),
      ]),
      error: (_, __) => const SizedBox.shrink(),
      data: (stats) => Row(children: [
        Expanded(child: _StatCard(
          label: 'Thu nhập', icon: Icons.arrow_downward_rounded,
          amount: stats['income'] ?? 0, positive: true, privacyMode: privacyMode,
        )),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(
          label: 'Chi tiêu', icon: Icons.arrow_upward_rounded,
          amount: stats['expense'] ?? 0, positive: false, privacyMode: privacyMode,
        )),
      ]),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final IconData icon;
  final double amount;
  final bool positive;
  final bool privacyMode;

  const _StatCard({
    required this.label, required this.icon,
    required this.amount, required this.positive, required this.privacyMode,
  });

  @override
  Widget build(BuildContext context) {
    final color = positive ? AppColors.income : AppColors.expense;
    final fmt = NumberFormat.compactCurrency(locale: 'vi_VN', symbol: '');
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface, borderRadius: BorderRadius.circular(AppTheme.radiusL),
        boxShadow: AppTheme.shadowS,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 34, height: 34,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
            child: Icon(icon, color: color, size: 18)),
          const Spacer(),
          Text(positive ? '+' : '-',
              style: AppTextStyles.headingM.copyWith(color: color)),
        ]),
        const SizedBox(height: 12),
        Text(label, style: AppTextStyles.bodyS),
        const SizedBox(height: 4),
        Text(
          privacyMode ? '••••••' : '${fmt.format(amount)} ₫',
          style: AppTextStyles.moneyS.copyWith(color: color),
          overflow: TextOverflow.ellipsis,
        ),
      ]),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 90, padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface, borderRadius: BorderRadius.circular(AppTheme.radiusL)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(width: 34, height: 34, decoration: BoxDecoration(color: AppColors.grey200, shape: BoxShape.circle)),
        const Spacer(),
        Container(height: 10, width: 60, color: AppColors.grey200),
        const SizedBox(height: 6),
        Container(height: 14, width: 80, color: AppColors.grey200),
      ]),
    );
  }
}
