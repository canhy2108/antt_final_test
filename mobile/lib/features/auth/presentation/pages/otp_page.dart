import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pinput/pinput.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/security/secure_storage_service.dart';

class OtpPage extends ConsumerStatefulWidget {
  final String email;
  const OtpPage({super.key, required this.email});
  @override
  ConsumerState<OtpPage> createState() => _OtpPageState();
}

class _OtpPageState extends ConsumerState<OtpPage> {
  int _countdown = 30;
  Timer? _timer;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  void _startCountdown() {
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_countdown == 0) {
        t.cancel();
      } else {
        setState(() => _countdown--);
      }
    });
  }

  Future<void> _verify(String code) async {
    setState(() { _loading = true; _error = null; });
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/auth/verify-otp', data: {
        'email': widget.email,
        'code': code,
      });
      final storage = ref.read(secureStorageProvider);
      await storage.saveTokens(
        accessToken: res.data['access_token'],
        refreshToken: res.data['refresh_token'],
        expiry: DateTime.now().add(const Duration(minutes: 30)),
      );
      if (mounted) context.go(AppRoutes.passkeyUpsell);
    } on Exception {
      HapticFeedback.heavyImpact();
      if (mounted) {
        setState(() {
          _error = 'Mã OTP không đúng. Thử lại.';
          _loading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pinTheme = PinTheme(
      width: 52, height: 60,
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              GestureDetector(
                onTap: () => context.pop(),
                child: Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    shape: BoxShape.circle,
                    boxShadow: AppTheme.shadowS,
                  ),
                  child: const Icon(Icons.arrow_back_rounded, size: 22),
                ),
              ),
              const SizedBox(height: 28),
              Text('Xác thực 2 bước 🔒', style: AppTextStyles.displayM),
              const SizedBox(height: 8),
              Text.rich(
                TextSpan(
                  text: 'Nhập mã 6 chữ số từ ứng dụng Google Authenticator cho tài khoản ',
                  style: AppTextStyles.bodyM.copyWith(color: AppColors.textSecondary),
                  children: [
                    TextSpan(
                      text: widget.email,
                      style: AppTextStyles.bodyM.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 40),
              Center(
                child: Pinput(
                  length: 6,
                  defaultPinTheme: pinTheme,
                  focusedPinTheme: pinTheme.copyDecorationWith(
                    border: Border.all(color: AppColors.primary, width: 2),
                  ),
                  errorPinTheme: pinTheme.copyDecorationWith(
                    border: Border.all(color: AppColors.expense, width: 2),
                  ),
                  errorText: _error,
                  onCompleted: _verify,
                  autofocus: true,
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Center(
                  child: Text(_error!,
                      style: AppTextStyles.bodyS.copyWith(color: AppColors.expense)),
                ),
              ],
              const SizedBox(height: 32),
              if (_loading)
                const Center(child: CircularProgressIndicator(color: AppColors.primary))
              else
                Center(
                  child: _countdown > 0
                      ? Text(
                          'Mã hết hạn sau $_countdown giây',
                          style: AppTextStyles.bodyS.copyWith(color: AppColors.textSecondary),
                        )
                      : TextButton(
                          onPressed: () {
                            setState(() => _countdown = 30);
                            _startCountdown();
                          },
                          child: const Text('Gửi lại mã'),
                        ),
                ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.grey100,
                  borderRadius: BorderRadius.circular(AppTheme.radiusM),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline_rounded,
                        size: 18, color: AppColors.textSecondary),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Không dùng SMS OTP vì dễ bị SIM Swap. Google Authenticator (TOTP) an toàn hơn nhiều.',
                        style: AppTextStyles.bodyS,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
