import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/models/transaction_model.dart';
import '../../../account/data/account_repository.dart';

class AccountsRow extends ConsumerWidget {
  final bool privacyMode;
  const AccountsRow({super.key, this.privacyMode = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accountsAsync = ref.watch(accountsProvider);
    return SizedBox(
      height: 130,
      child: accountsAsync.when(
        loading: () => ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppTheme.pageHorizontal),
          itemCount: 3,
          itemBuilder: (_, __) => Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Container(width: 160, decoration: BoxDecoration(
              color: AppColors.surface, borderRadius: BorderRadius.circular(AppTheme.radiusL)),
            ),
          ),
        ),
        error: (_, __) => const SizedBox.shrink(),
        data: (accounts) => accounts.isEmpty
          ? Center(child: Text('Chưa có tài khoản nào', style: AppTextStyles.bodyS))
          : ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppTheme.pageHorizontal),
            itemCount: accounts.length,
            itemBuilder: (_, i) => Padding(
              padding: const EdgeInsets.only(right: 12),
              child: _AccountCard(account: accounts[i], privacyMode: privacyMode),
            ),
          ),
      ),
    );
  }
}

class _AccountCard extends StatelessWidget {
  final AccountModel account;
  final bool privacyMode;
  const _AccountCard({required this.account, required this.privacyMode});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.compactCurrency(locale: 'vi_VN', symbol: '');
    return Container(
      width: 165,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [account.color, account.color.withValues(alpha: 0.7)],
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusL),
        boxShadow: [BoxShadow(color: account.color.withValues(alpha: 0.35), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 32, height: 32, decoration: const BoxDecoration(color: Colors.white24, shape: BoxShape.circle),
            child: const Icon(Icons.account_balance_wallet_rounded, color: Colors.white, size: 18)),
          const Spacer(),
          const Icon(Icons.more_horiz_rounded, color: Colors.white54, size: 20),
        ]),
        const Spacer(),
        Text(account.name, style: AppTextStyles.labelL.copyWith(color: Colors.white70), overflow: TextOverflow.ellipsis),
        const SizedBox(height: 4),
        Text(
          privacyMode ? '••••••' : '${fmt.format(account.balance)} ${account.currencySymbol}',
          style: AppTextStyles.moneyM.copyWith(color: Colors.white),
          overflow: TextOverflow.ellipsis,
        ),
      ]),
    );
  }
}
