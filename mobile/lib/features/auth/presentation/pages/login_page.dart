import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/security/biometric_service.dart';
import '../../../../core/security/secure_storage_service.dart';
import '../../../../core/network/api_client.dart';
import '../widgets/password_field.dart';
import '../widgets/auth_text_field.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;
  bool _hasBiometric = false;
  bool _hasPasskey = false;

  late final AnimationController _animCtrl;
  late final Animation<Offset> _slideAnim;
  late final Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
        duration: const Duration(milliseconds: 600), vsync: this);
    _slideAnim = Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
        .animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic));
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _animCtrl.forward();
    _checkBiometric();
  }

  Future<void> _checkBiometric() async {
    final storage = ref.read(secureStorageProvider);
    final biometricService = ref.read(biometricServiceProvider);
    final biometricEnabled = await storage.isBiometricEnabled();
    final available = await biometricService.isAvailable();
    final credId = await storage.getPasskeyCredentialId();

    if (mounted) {
      setState(() {
        _hasBiometric = biometricEnabled && available;
        _hasPasskey = credId != null;
      });
      // Auto-trigger biometric if available
      if (_hasBiometric) _loginWithBiometric();
    }
  }

  Future<void> _loginWithBiometric() async {
    final biometricService = ref.read(biometricServiceProvider);
    final result = await biometricService.authenticate(
      reason: 'Đăng nhập vào BudgetBee bằng sinh trắc học',
    );
    if (result == BiometricResult.success && mounted) {
      context.go(AppRoutes.dashboard);
    }
  }

  Future<void> _login() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final response = await api.post('/login', data: {
        'email': _emailCtrl.text.trim(),
        'password': _passCtrl.text,
      });

      final storage = ref.read(secureStorageProvider);
      await storage.saveTokens(
        accessToken: response.data['access_token'],
        refreshToken: response.data['refresh_token'],
        expiry: DateTime.now().add(const Duration(minutes: 30)),
      );
      await storage.saveUserInfo(
        userId: response.data['user']['id'].toString(),
        email: response.data['user']['email'],
        name: response.data['user']['name'],
      );

      if (mounted) {
        // Check if first login — show passkey upsell
        final passkeyEnabled = await storage.getPasskeyCredentialId();
        if (passkeyEnabled == null) {
          context.go(AppRoutes.passkeyUpsell);
        } else {
          context.go(AppRoutes.dashboard);
        }
      }
    } on Exception catch (e) {
      setState(() {
        _errorMessage = _parseError(e);
        _isLoading = false;
      });
      HapticFeedback.heavyImpact();
    }
  }

  String _parseError(Exception e) {
    final msg = e.toString().toLowerCase();
    if (msg.contains('401') || msg.contains('invalid')) {
      return 'Email hoặc mật khẩu không đúng';
    }
    if (msg.contains('429')) return 'Quá nhiều lần thử. Vui lòng đợi.';
    if (msg.contains('network') || msg.contains('socket')) {
      return 'Không có kết nối mạng';
    }
    return 'Đã có lỗi xảy ra. Thử lại sau.';
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _animCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeAnim,
          child: SlideTransition(
            position: _slideAnim,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppTheme.pageHorizontal),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 32),

                  // ── Logo ─────────────────────────────────────────────
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(AppTheme.radiusL),
                      boxShadow: AppTheme.shadowGreen,
                    ),
                    child: const Icon(
                      Icons.savings_rounded,
                      color: AppColors.dark,
                      size: 36,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // ── Greeting ─────────────────────────────────────────
                  Text('Chào mừng\ntrở lại! 👋', style: AppTextStyles.displayM),
                  const SizedBox(height: 8),
                  Text(
                    'Đăng nhập để quản lý tài chính của bạn',
                    style: AppTextStyles.bodyM.copyWith(
                        color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 40),

                  // ── Form ──────────────────────────────────────────────
                  Form(
                    key: _formKey,
                    child: Column(
                      children: [
                        AuthTextField(
                          controller: _emailCtrl,
                          label: 'Email',
                          hint: 'your@email.com',
                          keyboardType: TextInputType.emailAddress,
                          prefixIcon: Icons.mail_outline_rounded,
                          autofillHints: const [AutofillHints.email],
                          validator: (v) {
                            if (v == null || v.isEmpty) {
                              return 'Vui lòng nhập email';
                            }
                            if (!v.contains('@') || !v.contains('.')) {
                              return 'Email không hợp lệ';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        PasswordField(
                          controller: _passCtrl,
                          label: 'Mật khẩu',
                          validator: (v) {
                            if (v == null || v.isEmpty) {
                              return 'Vui lòng nhập mật khẩu';
                            }
                            return null;
                          },
                        ),

                        // Forgot Password
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: () =>
                                context.push(AppRoutes.forgotPassword),
                            child: Text('Quên mật khẩu?',
                                style: AppTextStyles.labelM.copyWith(
                                    color: AppColors.primary)),
                          ),
                        ),

                        // Error message
                        if (_errorMessage != null) ...[
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.expense.withOpacity(0.1),
                              borderRadius:
                                  BorderRadius.circular(AppTheme.radiusM),
                              border: Border.all(
                                  color: AppColors.expense.withOpacity(0.3)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.error_outline_rounded,
                                    color: AppColors.expense, size: 18),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    _errorMessage!,
                                    style: AppTextStyles.bodyS.copyWith(
                                        color: AppColors.expense),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        const SizedBox(height: 8),

                        // ── Primary Login Button ──────────────────────
                        ElevatedButton(
                          onPressed: _isLoading ? null : _login,
                          child: _isLoading
                              ? const SizedBox(
                                  height: 22,
                                  width: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                    color: AppColors.dark,
                                  ),
                                )
                              : const Text('Đăng nhập'),
                        ),

                        // ── Biometric / Passkey Buttons ───────────────
                        if (_hasBiometric || _hasPasskey) ...[
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(child: Divider(color: AppColors.border)),
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 12),
                                child: Text('hoặc',
                                    style: AppTextStyles.caption),
                              ),
                              Expanded(child: Divider(color: AppColors.border)),
                            ],
                          ),
                          const SizedBox(height: 16),
                          if (_hasBiometric)
                            OutlinedButton.icon(
                              onPressed: _loginWithBiometric,
                              icon: const Icon(Icons.fingerprint_rounded,
                                  color: AppColors.primary),
                              label: const Text('Đăng nhập bằng sinh trắc học'),
                            ),
                        ],

                        const SizedBox(height: 32),

                        // ── Register Link ─────────────────────────────
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('Chưa có tài khoản?',
                                style: AppTextStyles.bodyS),
                            TextButton(
                              onPressed: () => context.go(AppRoutes.register),
                              child: Text(
                                'Đăng ký ngay',
                                style: AppTextStyles.labelM.copyWith(
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.w700),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
