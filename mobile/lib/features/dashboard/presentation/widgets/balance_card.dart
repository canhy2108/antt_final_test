import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';

/// Main balance card — green gradient, inspired by design reference
class BalanceCard extends StatefulWidget {
  final bool privacyMode;
  final double totalBalance;
  final double changePercent;

  const BalanceCard({
    super.key,
    this.privacyMode = false,
    this.totalBalance = 0,
    this.changePercent = 0,
  });

  @override
  State<BalanceCard> createState() => _BalanceCardState();
}

class _BalanceCardState extends State<BalanceCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _countAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        duration: const Duration(milliseconds: 1200), vsync: this);
    _countAnim = CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic);
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  String _formatMoney(double amount) {
    if (widget.privacyMode) return '••••••';
    return NumberFormat.currency(locale: 'vi_VN', symbol: '₫')
        .format(amount);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.gradientStart, AppColors.gradientEnd],
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusXL),
        boxShadow: AppTheme.shadowGreen,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Period pill ─────────────────────────────────────────────
          Row(
            children: [
              _Pill(
                icon: Icons.calendar_today_rounded,
                label: _currentMonthLabel(),
              ),
              const Spacer(),
              if (widget.changePercent != 0)
                _ChangeBadge(percent: widget.changePercent),
            ],
          ),
          const SizedBox(height: 20),

          // ── Balance ─────────────────────────────────────────────────
          Text(
            'Tổng tài sản',
            style: AppTextStyles.bodyM.copyWith(
              color: AppColors.dark.withOpacity(0.7),
            ),
          ),
          const SizedBox(height: 6),
          AnimatedBuilder(
            animation: _countAnim,
            builder: (_, __) {
              final displayValue =
                  widget.privacyMode ? 0.0 : widget.totalBalance * _countAnim.value;
              return Text(
                _formatMoney(displayValue),
                style: AppTextStyles.moneyXL.copyWith(
                  color: AppColors.dark,
                ),
              );
            },
          ),
          const SizedBox(height: 20),

          // ── Progress bar (goal progress) ─────────────────────────────
          _ProgressBar(
            current: widget.totalBalance,
            target: widget.totalBalance * 2, // placeholder goal
            privacyMode: widget.privacyMode,
          ),
        ],
      ),
    );
  }

  String _currentMonthLabel() {
    return DateFormat('MMMM yyyy', 'vi').format(DateTime.now());
  }
}

class _Pill extends StatelessWidget {
  final IconData icon;
  final String label;

  const _Pill({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.dark,
        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppColors.white),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _ChangeBadge extends StatelessWidget {
  final double percent;
  const _ChangeBadge({required this.percent});

  @override
  Widget build(BuildContext context) {
    final isPositive = percent >= 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.dark.withOpacity(0.2),
        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isPositive ? Icons.trending_up_rounded : Icons.trending_down_rounded,
            size: 14,
            color: AppColors.dark,
          ),
          const SizedBox(width: 4),
          Text(
            '${isPositive ? '+' : ''}${percent.toStringAsFixed(1)}%',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.dark,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressBar extends StatelessWidget {
  final double current;
  final double target;
  final bool privacyMode;

  const _ProgressBar({
    required this.current,
    required this.target,
    required this.privacyMode,
  });

  @override
  Widget build(BuildContext context) {
    final ratio = target == 0 ? 0.0 : (current / target).clamp(0.0, 1.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              privacyMode ? '••%' : '${(ratio * 100).toInt()}%',
              style: AppTextStyles.labelL.copyWith(color: AppColors.dark),
            ),
            const Spacer(),
            Text(
              privacyMode
                  ? '•••••• / ••••••'
                  : '${NumberFormat.compactCurrency(locale: 'vi_VN', symbol: '₫').format(current)} / '
                      '${NumberFormat.compactCurrency(locale: 'vi_VN', symbol: '₫').format(target)}',
              style: AppTextStyles.caption.copyWith(color: AppColors.dark),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(AppTheme.radiusFull),
          child: LinearProgressIndicator(
            value: privacyMode ? null : ratio,
            minHeight: 6,
            backgroundColor: AppColors.dark.withOpacity(0.2),
            valueColor: const AlwaysStoppedAnimation(AppColors.dark),
          ),
        ),
      ],
    );
  }
}
