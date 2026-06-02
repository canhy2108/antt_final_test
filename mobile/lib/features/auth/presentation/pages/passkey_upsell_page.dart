import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/router/app_router.dart';

class PasskeyUpsellPage extends ConsumerWidget {
  const PasskeyUpsellPage({super.key});

  static const _benefits = [
    ('🚀', 'Đăng nhập trong 1 giây', 'Không cần nhớ mật khẩu'),
    ('🛡️', 'Không thể bị hack từ xa', 'Khoá nằm trên thiết bị của bạn'),
    ('🎯', 'Chống Phishing 100%', 'Không có mật khẩu để đánh cắp'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.pageHorizontal),
          child: Column(
            children: [
              const Spacer(),
              Container(
                width: 120, height: 120,
                decoration: BoxDecoration(
                  color: AppColors.dark,
                  borderRadius: BorderRadius.circular(AppTheme.radiusXL),
                  boxShadow: AppTheme.shadowL,
                ),
                child: const Icon(Icons.fingerprint_rounded,
                    size: 64, color: AppColors.primary),
              ),
              const SizedBox(height: 32),
              Text(
                'Đăng nhập nhanh hơn\n10 lần với Passkey 🔐',
                style: AppTextStyles.displayM,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                'Thay vì nhập mật khẩu mỗi lần, chỉ cần FaceID hoặc vân tay. '
                'An toàn hơn, nhanh hơn, không thể bị lừa đảo (Phishing-resistant).',
                style: AppTextStyles.bodyM.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              ..._benefits.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Row(
                  children: [
                    Text(item.$1, style: const TextStyle(fontSize: 28)),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.$2, style: AppTextStyles.headingS),
                          Text(item.$3, style: AppTextStyles.bodyS),
                        ],
                      ),
                    ),
                  ],
                ),
              )),
              const Spacer(),
              ElevatedButton(
                onPressed: () {
                  // TODO: Trigger WebAuthn/Passkey creation
                  context.go(AppRoutes.dashboard);
                },
                child: const Text('Kích hoạt Passkey ngay'),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => context.go(AppRoutes.dashboard),
                child: Text(
                  'Để sau',
                  style: AppTextStyles.bodyM.copyWith(color: AppColors.textSecondary),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
