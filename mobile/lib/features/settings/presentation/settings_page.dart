import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/security/secure_storage_service.dart';
import '../../../../core/security/biometric_service.dart';

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});
  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  bool _biometricEnabled = false;
  bool _privacyMode = false;
  String _userName = '';
  String _userEmail = '';

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final storage = ref.read(secureStorageProvider);
    final name = await storage.getUserName();
    final email = await storage.getUserEmail();
    final bio = await storage.isBiometricEnabled();
    final priv = await storage.isPrivacyMode();
    if (mounted) {
      setState(() {
        _userName = name ?? '';
        _userEmail = email ?? '';
        _biometricEnabled = bio;
        _privacyMode = priv;
      });
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusL)),
        title: Text('Dang xuat?', style: AppTextStyles.headingM),
        content: Text('Ban se can dang nhap lai lan sau.', style: AppTextStyles.bodyM),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Huy')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.expense, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Dang xuat'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await ref.read(secureStorageProvider).clearSession();
      context.go(AppRoutes.login);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTheme.pageHorizontal),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              Text('Cai dat', style: AppTextStyles.headingXL),
              const SizedBox(height: 24),

              // ── Profile card ──────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.gradientStart, AppColors.gradientEnd],
                    begin: Alignment.topLeft, end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(AppTheme.radiusXL),
                  boxShadow: AppTheme.shadowGreen,
                ),
                child: Row(children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.dark,
                    child: Text(
                      _userName.isNotEmpty ? _userName[0].toUpperCase() : '?',
                      style: AppTextStyles.headingL.copyWith(color: AppColors.primary),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_userName, style: AppTextStyles.headingM.copyWith(color: AppColors.dark)),
                    const SizedBox(height: 2),
                    Text(_userEmail, style: AppTextStyles.bodyS.copyWith(color: AppColors.dark)),
                  ])),
                  const Icon(Icons.chevron_right_rounded, color: AppColors.dark),
                ]),
              ),
              const SizedBox(height: 28),

              // ── Security section ──────────────────────────────────
              _SectionLabel(label: 'Bao mat'),
              _SettingsTile(
                icon: Icons.fingerprint_rounded,
                iconBg: AppColors.primary.withValues(alpha: 0.15),
                iconColor: AppColors.primary,
                title: 'Sinh trac hoc',
                subtitle: 'FaceID / Touch ID / Van tay',
                trailing: Switch.adaptive(
                  value: _biometricEnabled,
                  activeColor: AppColors.primary,
                  onChanged: (v) async {
                    if (v) {
                      final svc = ref.read(biometricServiceProvider);
                      final avail = await svc.isAvailable();
                      if (!avail && mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Thiet bi khong ho tro sinh trac hoc')));
                        return;
                      }
                    }
                    await ref.read(secureStorageProvider).setBiometricEnabled(v);
                    setState(() => _biometricEnabled = v);
                    HapticFeedback.selectionClick();
                  },
                ),
              ),
              _SettingsTile(
                icon: Icons.visibility_off_outlined,
                iconBg: AppColors.info.withValues(alpha: 0.12),
                iconColor: AppColors.info,
                title: 'Che do rieng tu',
                subtitle: 'An so du khi mo app',
                trailing: Switch.adaptive(
                  value: _privacyMode,
                  activeColor: AppColors.primary,
                  onChanged: (v) async {
                    await ref.read(secureStorageProvider).setPrivacyMode(v);
                    setState(() => _privacyMode = v);
                    HapticFeedback.selectionClick();
                  },
                ),
              ),
              _SettingsTile(
                icon: Icons.lock_reset_rounded,
                iconBg: AppColors.warning.withValues(alpha: 0.12),
                iconColor: AppColors.warning,
                title: 'Doi mat khau',
                onTap: () {},
              ),
              _SettingsTile(
                icon: Icons.verified_user_rounded,
                iconBg: AppColors.income.withValues(alpha: 0.12),
                iconColor: AppColors.income,
                title: 'Xac minh 2 buoc (2FA)',
                subtitle: 'Google Authenticator',
                onTap: () {},
              ),
              const SizedBox(height: 20),

              // ── App section ───────────────────────────────────────
              _SectionLabel(label: 'Ung dung'),
              _SettingsTile(
                icon: Icons.language_rounded,
                iconBg: AppColors.grey100,
                iconColor: AppColors.grey600,
                title: 'Ngon ngu',
                subtitle: 'Tieng Viet',
                onTap: () {},
              ),
              _SettingsTile(
                icon: Icons.dark_mode_rounded,
                iconBg: AppColors.grey100,
                iconColor: AppColors.grey600,
                title: 'Giao dien',
                subtitle: 'He thong',
                onTap: () {},
              ),
              _SettingsTile(
                icon: Icons.currency_exchange_rounded,
                iconBg: AppColors.grey100,
                iconColor: AppColors.grey600,
                title: 'Tien te',
                subtitle: 'VND - Dong Viet Nam',
                onTap: () {},
              ),
              const SizedBox(height: 20),

              // ── Data section ──────────────────────────────────────
              _SectionLabel(label: 'Du lieu'),
              _SettingsTile(
                icon: Icons.upload_file_rounded,
                iconBg: AppColors.grey100,
                iconColor: AppColors.grey600,
                title: 'Nhap du lieu',
                subtitle: 'Tu Excel / JSON',
                onTap: () {},
              ),
              _SettingsTile(
                icon: Icons.download_rounded,
                iconBg: AppColors.grey100,
                iconColor: AppColors.grey600,
                title: 'Xuat du lieu',
                subtitle: 'PDF / CSV / JSON',
                onTap: () {},
              ),
              const SizedBox(height: 28),

              // ── Logout ─────────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _logout,
                  icon: const Icon(Icons.logout_rounded, color: AppColors.expense),
                  label: Text('Dang xuat', style: AppTextStyles.buttonL.copyWith(color: AppColors.expense)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.expense),
                    foregroundColor: AppColors.expense,
                  ),
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(label.toUpperCase(), style: AppTextStyles.caption.copyWith(
      fontWeight: FontWeight.w700, letterSpacing: 1.0)),
  );
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  const _SettingsTile({
    required this.icon, required this.iconBg, required this.iconColor,
    required this.title, this.subtitle, this.trailing, this.onTap,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusL),
        boxShadow: AppTheme.shadowS,
      ),
      child: Row(children: [
        Container(width: 40, height: 40,
          decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(AppTheme.radiusM)),
          child: Icon(icon, color: iconColor, size: 20)),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: AppTextStyles.headingS),
          if (subtitle != null) ...[
            const SizedBox(height: 2),
            Text(subtitle!, style: AppTextStyles.bodyS),
          ],
        ])),
        trailing ?? (onTap != null
          ? const Icon(Icons.chevron_right_rounded, color: AppColors.grey400, size: 22)
          : const SizedBox.shrink()),
      ]),
    ),
  );
}
