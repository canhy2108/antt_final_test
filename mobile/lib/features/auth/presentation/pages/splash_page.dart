import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/security/secure_storage_service.dart';
import '../../../../core/network/api_client.dart';

class SplashPage extends ConsumerStatefulWidget {
  const SplashPage({super.key});

  @override
  ConsumerState<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends ConsumerState<SplashPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fadeAnim;
  late final Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );

    _fadeAnim = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
          parent: _controller, curve: const Interval(0, 0.6, curve: Curves.easeOut)),
    );

    _scaleAnim = Tween<double>(begin: 0.8, end: 1).animate(
      CurvedAnimation(
          parent: _controller, curve: const Interval(0, 0.6, curve: Curves.easeOutBack)),
    );

    _controller.forward();
    _init();
  }

  Future<void> _init() async {
    // Bootstrap network layer (cookie jar + dio interceptors) BEFORE any
    // page calls into apiClientProvider. Done in parallel with the splash
    // animation delay to keep startup snappy.
    final initFuture = ref.read(apiClientInitProvider.future);
    await Future.wait([
      initFuture,
      Future.delayed(const Duration(milliseconds: 2000)),
    ]);
    if (!mounted) return;

    final storage = ref.read(secureStorageProvider);
    final token = await storage.getAccessToken();

    if (token == null) {
      context.go(AppRoutes.login);
      return;
    }

    // Check session timeout + biometric
    final biometricEnabled = await storage.isBiometricEnabled();
    final timedOut = await storage.isSessionTimedOut(timeoutMinutes: 30);

    if (biometricEnabled && timedOut) {
      if (!mounted) return;
      context.go(AppRoutes.biometricLock);
    } else {
      if (!mounted) return;
      context.go(AppRoutes.dashboard);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Center(
        child: FadeTransition(
          opacity: _fadeAnim,
          child: ScaleTransition(
            scale: _scaleAnim,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Logo container
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(AppTheme.radiusXL),
                    boxShadow: AppTheme.shadowGreen,
                  ),
                  child: const Icon(
                    Icons.savings_rounded,
                    color: AppColors.dark,
                    size: 52,
                  ),
                ),
                const SizedBox(height: 20),
                Text('BudgetBee', style: AppTextStyles.displayM),
                const SizedBox(height: 6),
                Text(
                  'Smart Personal Finance',
                  style: AppTextStyles.bodyM.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 48),
                SizedBox(
                  width: 32,
                  height: 32,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: AppColors.primary,
                    backgroundColor: AppColors.grey200,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
