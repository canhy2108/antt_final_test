import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/network/api_client.dart';
import '../widgets/password_field.dart';
import '../widgets/auth_text_field.dart';

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});
  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _isLoading = false;
  bool _agreedToTerms = false;
  String? _errorMessage;
  int _step = 0;

  @override
  void dispose() {
    _nameCtrl.dispose(); _emailCtrl.dispose();
    _passCtrl.dispose(); _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (!_agreedToTerms) {
      setState(() => _errorMessage = 'Vui lòng đồng ý điều khoản sử dụng');
      return;
    }
    setState(() { _isLoading = true; _errorMessage = null; });
    try {
      final api = ref.read(apiClientProvider);
      await api.post('/setup/register', data: {
        'name': _nameCtrl.text.trim(),
        'email': _emailCtrl.text.trim().toLowerCase(),
        'password': _passCtrl.text,
        'confirm_password': _confirmCtrl.text,
      });
      if (mounted) context.go(AppRoutes.login);
    } on Exception catch (e) {
      if (mounted) {
        setState(() {
        _errorMessage = e.toString().contains('422')
            ? 'Email đã được sử dụng'
            : 'Đăng ký thất bại. Thử lại.';
        _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTheme.pageHorizontal),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 16),
                // ── Back button ────────────────────────────────────
                GestureDetector(
                  onTap: () => context.go(AppRoutes.login),
                  child: Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.surface, shape: BoxShape.circle,
                      boxShadow: AppTheme.shadowS),
                    child: const Icon(Icons.arrow_back_rounded, size: 22),
                  ),
                ),
                const SizedBox(height: 24),
                Text('Tạo tài khoản\nmới 🎉', style: AppTextStyles.displayM),
                const SizedBox(height: 8),
                Text('Quản lý tài chính thông minh bắt đầu từ đây',
                    style: AppTextStyles.bodyM.copyWith(color: AppColors.textSecondary)),
                const SizedBox(height: 28),
                // ── Step bar ───────────────────────────────────────
                Row(children: List.generate(2, (i) => Expanded(
                  child: Container(
                    height: 5, margin: EdgeInsets.only(right: i < 1 ? 8 : 0),
                    decoration: BoxDecoration(
                      color: i <= _step ? AppColors.primary : AppColors.grey200,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ))),
                const SizedBox(height: 28),
                // ── Step content ───────────────────────────────────
                if (_step == 0) ...[
                  AuthTextField(
                    controller: _nameCtrl, label: 'Họ và tên', hint: 'Nguyễn Văn A',
                    prefixIcon: Icons.person_outline_rounded,
                    textInputAction: TextInputAction.next,
                    validator: (v) => (v == null || v.trim().length < 2)
                        ? 'Tên phải có ít nhất 2 ký tự' : null,
                  ),
                  const SizedBox(height: 16),
                  AuthTextField(
                    controller: _emailCtrl, label: 'Email', hint: 'your@email.com',
                    prefixIcon: Icons.mail_outline_rounded,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.done,
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Nhập email';
                      if (!RegExp(r'^[\w.-]+@[\w.-]+\.\w{2,}').hasMatch(v)) {
                        return 'Email không hợp lệ';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: () {
                      if (_nameCtrl.text.length >= 2 && _emailCtrl.text.contains('@')) {
                        setState(() => _step = 1);
                      }
                    },
                    child: const Text('Tiếp theo →'),
                  ),
                ] else ...[
                  // Passphrase tip
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(AppTheme.radiusM),
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                    ),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('💡', style: TextStyle(fontSize: 16)),
                      const SizedBox(width: 10),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Dùng cụm từ thay mật khẩu!', style: AppTextStyles.labelL),
                        const SizedBox(height: 4),
                        Text(
                          'VD: "troi-xanh-mua-xuan-2026" — 24 ký tự, rất khó hack mà dễ nhớ',
                          style: AppTextStyles.bodyS,
                        ),
                      ])),
                    ]),
                  ),
                  const SizedBox(height: 16),
                  PasswordField(
                    controller: _passCtrl, label: 'Mật khẩu (tối thiểu 12 ký tự)',
                    showStrengthMeter: true, textInputAction: TextInputAction.next,
                    validator: (v) => (v == null || v.length < 12)
                        ? 'Mật khẩu tối thiểu 12 ký tự' : null,
                  ),
                  const SizedBox(height: 16),
                  PasswordField(
                    controller: _confirmCtrl, label: 'Xác nhận mật khẩu',
                    textInputAction: TextInputAction.done, onFieldSubmitted: _submit,
                    validator: (v) => v != _passCtrl.text ? 'Mật khẩu không khớp' : null,
                  ),
                  const SizedBox(height: 16),
                  // Terms checkbox
                  GestureDetector(
                    onTap: () => setState(() => _agreedToTerms = !_agreedToTerms),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 22, height: 22,
                        decoration: BoxDecoration(
                          color: _agreedToTerms ? AppColors.primary : AppColors.surface,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: _agreedToTerms ? AppColors.primary : AppColors.border, width: 1.5),
                        ),
                        child: _agreedToTerms
                            ? const Icon(Icons.check_rounded, size: 16, color: AppColors.dark)
                            : null,
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: Text.rich(TextSpan(
                        text: 'Tôi đồng ý với ', style: AppTextStyles.bodyS,
                        children: [
                          TextSpan(text: 'Điều khoản sử dụng',
                              style: AppTextStyles.bodyS.copyWith(
                                  color: AppColors.primary, decoration: TextDecoration.underline)),
                          const TextSpan(text: ' và '),
                          TextSpan(text: 'Chính sách bảo mật',
                              style: AppTextStyles.bodyS.copyWith(
                                  color: AppColors.primary, decoration: TextDecoration.underline)),
                        ],
                      ))),
                    ]),
                  ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                          color: AppColors.expense.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(AppTheme.radiusM)),
                      child: Text(_errorMessage!,
                          style: AppTextStyles.bodyS.copyWith(color: AppColors.expense)),
                    ),
                  ],
                  const SizedBox(height: 24),
                  Row(children: [
                    Expanded(flex: 1, child: OutlinedButton(
                        onPressed: () => setState(() => _step = 0),
                        child: const Text('Quay lại'))),
                    const SizedBox(width: 12),
                    Expanded(flex: 2, child: ElevatedButton(
                      onPressed: _isLoading ? null : _submit,
                      child: _isLoading
                          ? const SizedBox(width: 22, height: 22,
                              child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.dark))
                          : const Text('Tạo tài khoản'),
                    )),
                  ]),
                ],
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
