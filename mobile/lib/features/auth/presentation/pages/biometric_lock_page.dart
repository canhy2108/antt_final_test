import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pinput/pinput.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/security/biometric_service.dart';
import '../../../../core/security/secure_storage_service.dart';

class BiometricLockPage extends ConsumerStatefulWidget {
  const BiometricLockPage({super.key});
  @override
  ConsumerState<BiometricLockPage> createState() => _BiometricLockPageState();
}

class _BiometricLockPageState extends ConsumerState<BiometricLockPage> {
  bool _showPin = false;
  String? _pinError;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryBiometric());
  }

  Future<void> _tryBiometric() async {
    setState(() => _loading = true);
    final svc = ref.read(biometricServiceProvider);
    final result = await svc.authenticate(
        reason: 'Xác thực để vào BudgetBee');
    setState(() => _loading = false);
    if (result == BiometricResult.success && mounted) {
      await ref.read(secureStorageProvider).updateLastActive();
      if (mounted) context.go(AppRoutes.dashboard);
    }
  }

  Future<void> _checkPin(String pin) async {
    final storage = ref.read(secureStorageProvider);
    final savedHash = await storage.getPinHash();
    // Simple hash compare (in prod use Argon2id)
    final inputHash = pin.hashCode.toString();
    if (savedHash == inputHash) {
      await storage.updateLastActive();
      if (mounted) context.go(AppRoutes.dashboard);
    } else {
      HapticFeedback.heavyImpact();
      setState(() => _pinError = 'PIN không đúng. Thử lại.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final pinTheme = PinTheme(
      width: 56, height: 56,
      textStyle: AppTextStyles.headingL,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusM),
        boxShadow: AppTheme.shadowS,
      ),
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.pageHorizontal),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(),
              // Logo
              Container(
                width: 88, height: 88,
                decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(AppTheme.radiusXL),
                    boxShadow: AppTheme.shadowGreen),
                child: const Icon(Icons.savings_rounded, color: AppColors.dark, size: 48),
              ),
              const SizedBox(height: 24),
              Text('BudgetBee', style: AppTextStyles.headingXL),
              const SizedBox(height: 8),
              Text(
                _showPin ? 'Nhập mã PIN của bạn' : 'Xác thực sinh trắc học để tiếp tục',
                style: AppTextStyles.bodyM.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              if (_showPin) ...[
                Pinput(
                  length: 6,
                  obscureText: true,
                  defaultPinTheme: pinTheme,
                  focusedPinTheme: pinTheme.copyDecorationWith(
                    border: Border.all(color: AppColors.primary, width: 2),
                  ),
                  errorPinTheme: pinTheme.copyDecorationWith(
                    border: Border.all(color: AppColors.expense, width: 2),
                  ),
                  onCompleted: _checkPin,
                ),
                if (_pinError != null) ...[
                  const SizedBox(height: 12),
                  Text(_pinError!, style: AppTextStyles.bodyS.copyWith(color: AppColors.expense)),
                ],
                const SizedBox(height: 24),
                TextButton(
                    onPressed: () => setState(() { _showPin = false; _pinError = null; }),
                    child: const Text('Dùng sinh trắc học')),
              ] else ...[
                if (_loading)
                  const CircularProgressIndicator(color: AppColors.primary)
                else
                  GestureDetector(
                    onTap: _tryBiometric,
                    child: Container(
                      width: 80, height: 80,
                      decoration: BoxDecoration(
                        color: AppColors.dark, shape: BoxShape.circle,
                        boxShadow: AppTheme.shadowL,
                      ),
                      child: const Icon(Icons.fingerprint_rounded, size: 44, color: AppColors.primary),
                    ),
                  ),
                const SizedBox(height: 24),
                TextButton(
                    onPressed: () => setState(() => _showPin = true),
                    child: const Text('Dùng mã PIN thay thế')),
              ],
              const Spacer(),
              TextButton(
                onPressed: () async {
                  await ref.read(secureStorageProvider).clearSession();
                  if (mounted) context.go(AppRoutes.login);
                },
                child: Text('Đăng xuất', style: AppTextStyles.bodyS.copyWith(color: AppColors.textSecondary)),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
