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
  BiometricCapability _bioCapability = BiometricCapability.unavailable;

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final storage = ref.read(secureStorageProvider);
    final bioSvc = ref.read(biometricServiceProvider);
    final name = await storage.getUserName();
    final email = await storage.getUserEmail();
    final bio = await storage.isBiometricEnabled();
    final priv = await storage.isPrivacyMode();
    final cap = await bioSvc.getCapability();
    if (mounted) {
      setState(() {
        _userName = name ?? '';
        _userEmail = email ?? '';
        _biometricEnabled = bio;
        _privacyMode = priv;
        _bioCapability = cap;
      });
    }
  }

  String get _bioSubtitle {
    switch (_bioCapability) {
      case BiometricCapability.biometric:
        return 'Van tay / Khuon mat da san sang';
      case BiometricCapability.deviceCredential:
        return 'Se dung PIN / hinh ve thiet bi (chua co van tay)';
      case BiometricCapability.unavailable:
        return 'Hay cai dat khoa man hinh trong Settings cua thiet bi';
    }
  }

  Future<void> _showBiometricSetupHelp() async {
    await showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusL)),
        title: Text('Cach bat sinh trac hoc', style: AppTextStyles.headingM),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Thiet bi chua co khoa man hinh. De dung sinh trac hoc cho BudgetBee:',
              style: AppTextStyles.bodyM,
            ),
            const SizedBox(height: 12),
            Text('1. Mo Settings cua thiet bi', style: AppTextStyles.bodyS),
            Text('2. Vao Security hoac Bao mat', style: AppTextStyles.bodyS),
            Text('3. Cai PIN / hinh ve / mat khau', style: AppTextStyles.bodyS),
            Text('4. (Tuy chon) Them van tay / khuon mat', style: AppTextStyles.bodyS),
            Text('5. Quay lai BudgetBee va bat lai', style: AppTextStyles.bodyS),
            const SizedBox(height: 12),
            Text(
              'Tren Android Emulator: vao Extended Controls → Fingerprint → Touch sensor',
              style: AppTextStyles.bodyS.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Da hieu')),
        ],
      ),
    );
  }

  String _authResultMessage(BiometricResult r) {
    switch (r) {
      case BiometricResult.notAvailable:
        return 'Thiet bi chua cai khoa man hinh. Vao Settings de cai PIN/van tay.';
      case BiometricResult.notEnrolled:
        return 'Chua co van tay/khuon mat. Vao Settings -> Bao mat de them.';
      case BiometricResult.lockedOut:
        return 'Da bi khoa tam thoi do nhieu lan that bai. Thu lai sau.';
      case BiometricResult.failed:
        return 'Xac thuc that bai. Vui long thu lai.';
      case BiometricResult.error:
        return 'Co loi khong xac dinh. Thu lai sau.';
      case BiometricResult.success:
        return 'OK';
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
      if (mounted) context.go(AppRoutes.login);
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
              const _SectionLabel(label: 'Bao mat'),
              _SettingsTile(
                icon: Icons.fingerprint_rounded,
                iconBg: AppColors.primary.withValues(alpha: 0.15),
                iconColor: AppColors.primary,
                title: 'Sinh trac hoc',
                subtitle: _bioSubtitle,
                onTap: _bioCapability == BiometricCapability.unavailable
                    ? _showBiometricSetupHelp
                    : null,
                trailing: Switch.adaptive(
                  value: _biometricEnabled,
                  activeTrackColor: AppColors.primary,
                  onChanged: (v) async {
                    if (v) {
                      // Re-check capability — user may have just enrolled
                      // a fingerprint in device settings.
                      final svc = ref.read(biometricServiceProvider);
                      final cap = await svc.getCapability();
                      if (!mounted) return;
                      setState(() => _bioCapability = cap);

                      if (cap == BiometricCapability.unavailable) {
                        await _showBiometricSetupHelp();
                        return;
                      }

                      // Verify with an actual auth prompt before we trust
                      // the switch — otherwise the user could enable it
                      // and then be locked out next launch.
                      final result = await svc.authenticate(
                        reason: 'Xac nhan de bat sinh trac hoc cho BudgetBee',
                      );
                      if (!mounted) return;
                      if (result != BiometricResult.success) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(_authResultMessage(result))),
                        );
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
                  activeTrackColor: AppColors.primary,
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
              const _SectionLabel(label: 'Ung dung'),
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
              const _SectionLabel(label: 'Du lieu'),
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
