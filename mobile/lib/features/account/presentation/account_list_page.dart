import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/models/transaction_model.dart';
import '../data/account_repository.dart';

class AccountListPage extends ConsumerWidget {
  const AccountListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accountsAsync = ref.watch(accountsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── Header ─────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Row(
                  children: [
                    Text('Tài khoản', style: AppTextStyles.headingXL),
                    const Spacer(),
                    GestureDetector(
                      onTap: () {
                        HapticFeedback.mediumImpact();
                        // TODO: Navigate to create account page
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

            // ── Total balance ──────────────────────────────────────
            SliverToBoxAdapter(
              child: accountsAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
                data: (accounts) {
                  final total = accounts.fold<double>(0, (sum, a) => sum + a.balance);
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: _TotalBalanceCard(total: total, count: accounts.length),
                  );
                },
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),

            // ── Account list ───────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Text('Danh sách tài khoản', style: AppTextStyles.headingM),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 12)),

            accountsAsync.when(
              loading: () => const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
              ),
              error: (_, __) => SliverFillRemaining(
                child: Center(child: Text('Lỗi tải dữ liệu', style: AppTextStyles.bodyM)),
              ),
              data: (accounts) => accounts.isEmpty
                ? SliverFillRemaining(child: _EmptyState())
                : SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _AccountTile(account: accounts[i]),
                        ),
                        childCount: accounts.length,
                      ),
                    ),
                  ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }
}

// ── Total Balance Hero ────────────────────────────────────────────────────────
class _TotalBalanceCard extends StatelessWidget {
  final double total;
  final int count;
  const _TotalBalanceCard({required this.total, required this.count});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'vi_VN', symbol: '₫');
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.gradientStart, AppColors.gradientEnd],
          begin: Alignment.topLeft, end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusXL),
        boxShadow: AppTheme.shadowGreen,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Tổng số dư',
            style: AppTextStyles.bodyM.copyWith(
                color: AppColors.dark.withValues(alpha: 0.7)),
          ),
          const SizedBox(height: 8),
          Text(
            fmt.format(total),
            style: AppTextStyles.moneyXL.copyWith(color: AppColors.dark),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.dark.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(AppTheme.radiusFull),
            ),
            child: Text(
              '$count tài khoản',
              style: AppTextStyles.caption.copyWith(
                color: AppColors.dark, fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Account Tile ─────────────────────────────────────────────────────────────
class _AccountTile extends StatelessWidget {
  final AccountModel account;
  const _AccountTile({required this.account});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'vi_VN', symbol: account.currencySymbol);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusL),
        boxShadow: AppTheme.shadowS,
      ),
      child: Row(
        children: [
          Container(
            width: 48, height: 48,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [account.color, account.color.withValues(alpha: 0.7)],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(AppTheme.radiusM),
              boxShadow: [
                BoxShadow(
                  color: account.color.withValues(alpha: 0.35),
                  blurRadius: 8, offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.account_balance_wallet_rounded,
                color: Colors.white, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(account.name, style: AppTextStyles.headingS),
                const SizedBox(height: 2),
                Text(account.type, style: AppTextStyles.bodyS),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                fmt.format(account.balance),
                style: AppTextStyles.moneyS,
              ),
              const SizedBox(height: 2),
              const Icon(Icons.chevron_right_rounded,
                  color: AppColors.grey400, size: 18),
            ],
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 80, height: 80,
          decoration: const BoxDecoration(
              color: AppColors.grey100, shape: BoxShape.circle),
          child: const Icon(Icons.account_balance_wallet_outlined,
              size: 40, color: AppColors.grey400),
        ),
        const SizedBox(height: 16),
        Text('Chưa có tài khoản nào', style: AppTextStyles.headingM),
        const SizedBox(height: 8),
        Text(
          'Thêm tài khoản đầu tiên để bắt đầu\nquản lý tài chính',
          style: AppTextStyles.bodyS,
          textAlign: TextAlign.center,
        ),
      ],
    ),
  );
}
