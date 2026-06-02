import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/security/secure_storage_service.dart';
import '../../../../core/router/app_router.dart';
import '../widgets/balance_card.dart';
import '../widgets/quick_stats_row.dart';
import '../widgets/recent_transactions.dart';
import '../widgets/accounts_row.dart';

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});

  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage> {
  bool _privacyMode = false;
  String _userName = 'Người dùng';

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final storage = ref.read(secureStorageProvider);
    final name = await storage.getUserName();
    final privacy = await storage.isPrivacyMode();
    if (mounted) {
      setState(() {
        _userName = name?.split(' ').first ?? 'Người dùng';
        _privacyMode = privacy;
      });
    }
  }

  Future<void> _togglePrivacy() async {
    HapticFeedback.lightImpact();
    final storage = ref.read(secureStorageProvider);
    final newMode = !_privacyMode;
    await storage.setPrivacyMode(newMode);
    setState(() => _privacyMode = newMode);
  }

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Chào buổi sáng,';
    if (hour < 17) return 'Chào buổi chiều,';
    return 'Chào buổi tối,';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadPrefs,
          color: AppColors.primary,
          child: CustomScrollView(
            slivers: [
              // ── Header ────────────────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                      AppTheme.pageHorizontal, 20, AppTheme.pageHorizontal, 0),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _greeting,
                              style: AppTextStyles.bodyM.copyWith(
                                  color: AppColors.textSecondary),
                            ),
                            Text(
                              '$_userName 👋',
                              style: AppTextStyles.headingL,
                            ),
                          ],
                        ),
                      ),
                      // Privacy Toggle
                      _IconButton(
                        icon: _privacyMode
                            ? Icons.visibility_off_rounded
                            : Icons.visibility_rounded,
                        onTap: _togglePrivacy,
                        isActive: _privacyMode,
                      ),
                      const SizedBox(width: 8),
                      // Notification Bell
                      _IconButton(
                        icon: Icons.notifications_none_rounded,
                        onTap: () {},
                        badge: 2,
                      ),
                    ],
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 24)),

              // ── Main Balance Card ─────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.pageHorizontal),
                  child: BalanceCard(privacyMode: _privacyMode),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 24)),

              // ── Quick Stats (Income / Expense) ────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.pageHorizontal),
                  child: QuickStatsRow(privacyMode: _privacyMode),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 24)),

              // ── Accounts Horizontal Scroll ────────────────────────────
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppTheme.pageHorizontal),
                      child: _SectionHeader(
                        title: 'Tài khoản',
                        onSeeAll: () => context.go(AppRoutes.accounts),
                      ),
                    ),
                    const SizedBox(height: 12),
                    AccountsRow(privacyMode: _privacyMode),
                  ],
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 24)),

              // ── Recent Transactions ───────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.pageHorizontal),
                  child: _SectionHeader(
                    title: 'Gần đây',
                    onSeeAll: () => context.go(AppRoutes.transactions),
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 12)),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.pageHorizontal),
                  child: RecentTransactions(privacyMode: _privacyMode),
                ),
              ),

              // Bottom padding for FAB
              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Section Header ────────────────────────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  final String title;
  final VoidCallback? onSeeAll;

  const _SectionHeader({required this.title, this.onSeeAll});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(title, style: AppTextStyles.headingM),
        const Spacer(),
        if (onSeeAll != null)
          GestureDetector(
            onTap: onSeeAll,
            child: Text(
              'Xem tất cả',
              style: AppTextStyles.labelM.copyWith(color: AppColors.primary),
            ),
          ),
      ],
    );
  }
}

// ── Icon Button with Badge ────────────────────────────────────────────────────
class _IconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final int? badge;
  final bool isActive;

  const _IconButton({
    required this.icon,
    required this.onTap,
    this.badge,
    this.isActive = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: isActive ? AppColors.primary.withValues(alpha: 0.15) : AppColors.surface,
              shape: BoxShape.circle,
              boxShadow: AppTheme.shadowS,
            ),
            child: Icon(
              icon,
              size: 22,
              color: isActive ? AppColors.primary : AppColors.textPrimary,
            ),
          ),
          if (badge != null && badge! > 0)
            Positioned(
              right: -2,
              top: -2,
              child: Container(
                width: 18,
                height: 18,
                decoration: const BoxDecoration(
                  color: AppColors.expense,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '$badge',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
