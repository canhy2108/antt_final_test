import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/network/api_client.dart';
import '../widgets/auth_text_field.dart';

class ForgotPasswordPage extends ConsumerStatefulWidget {
  const ForgotPasswordPage({super.key});
  @override
  ConsumerState<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends ConsumerState<ForgotPasswordPage> {
  final _emailCtrl = TextEditingController();
  bool _sent = false;
  bool _loading = false;

  Future<void> _send() async {
    if (_emailCtrl.text.isEmpty || !_emailCtrl.text.contains('@')) return;
    setState(() => _loading = true);
    try {
      await ref.read(apiClientProvider).post('/password/email',
          data: {'email': _emailCtrl.text.trim()});
    } catch (_) {}
    if (mounted) setState(() { _sent = true; _loading = false; });
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
              if (!_sent) ...[
                Text('Quên mật khẩu? 🔑', style: AppTextStyles.displayM),
                const SizedBox(height: 8),
                Text(
                  'Nhập email của bạn, chúng tôi sẽ gửi link đặt lại mật khẩu.',
                  style: AppTextStyles.bodyM.copyWith(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 40),
                AuthTextField(
                  controller: _emailCtrl,
                  label: 'Email',
                  hint: 'your@email.com',
                  prefixIcon: Icons.mail_outline_rounded,
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _loading ? null : _send,
                  child: _loading
                      ? const SizedBox(
                          width: 22, height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.dark),
                        )
                      : const Text('Gửi link đặt lại mật khẩu'),
                ),
              ] else ...[
                const Spacer(),
                Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 100, height: 100,
                        decoration: const BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.mark_email_read_rounded,
                            size: 52, color: AppColors.dark),
                      ),
                      const SizedBox(height: 28),
                      Text('Kiểm tra email! 📬',
                          style: AppTextStyles.displayM,
                          textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      Text(
                        'Link đặt lại mật khẩu đã được gửi tới\n${_emailCtrl.text}',
                        style: AppTextStyles.bodyM.copyWith(color: AppColors.textSecondary),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                ElevatedButton(
                  onPressed: () => context.go(AppRoutes.login),
                  child: const Text('Trở về đăng nhập'),
                ),
                const SizedBox(height: 16),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
