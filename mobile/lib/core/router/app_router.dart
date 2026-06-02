import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/auth/presentation/pages/splash_page.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/auth/presentation/pages/biometric_lock_page.dart';
import '../../features/auth/presentation/pages/pin_setup_page.dart';
import '../../features/auth/presentation/pages/otp_page.dart';
import '../../features/auth/presentation/pages/forgot_password_page.dart';
import '../../features/auth/presentation/pages/passkey_upsell_page.dart';
import '../../features/dashboard/presentation/pages/dashboard_page.dart';
import '../../features/transaction/presentation/pages/transaction_form_page.dart';
import '../../features/transaction/presentation/pages/transaction_list_page.dart';
import '../../features/account/presentation/account_list_page.dart';
import '../../features/budget/presentation/budget_page.dart';
import '../../features/reports/presentation/reports_page.dart';
import '../../features/settings/presentation/settings_page.dart';
import '../../features/ekyc/presentation/ekyc_page.dart';
import '../widgets/main_scaffold.dart';
import '../security/secure_storage_service.dart';

// ── Route paths (const — avoids typos) ──────────────────────────────────────
abstract class AppRoutes {
  static const splash = '/';
  static const login = '/login';
  static const register = '/register';
  static const forgotPassword = '/forgot-password';
  static const otp = '/otp';
  static const biometricLock = '/biometric-lock';
  static const pinSetup = '/pin-setup';
  static const passkeyUpsell = '/passkey-upsell';
  static const ekyc = '/ekyc';

  static const dashboard = '/home';
  static const transactions = '/transactions';
  static const transactionAdd = '/transactions/add';
  static const transactionEdit = '/transactions/:id';
  static const accounts = '/accounts';
  static const budget = '/budget';
  static const reports = '/reports';
  static const settings = '/settings';
}

// ── Router Provider ──────────────────────────────────────────────────────────
final routerProvider = Provider<GoRouter>((ref) {
  final storage = ref.read(secureStorageProvider);

  return GoRouter(
    initialLocation: AppRoutes.splash,
    debugLogDiagnostics: true,

    // ── Auth Guard ─────────────────────────────────────────────────────────
    redirect: (context, state) async {
      final token = await storage.getAccessToken();
      final isAuthenticated = token != null;
      final isGoingToAuth = state.matchedLocation == AppRoutes.login ||
          state.matchedLocation == AppRoutes.register ||
          state.matchedLocation == AppRoutes.splash;

      // Session timeout check
      if (isAuthenticated && !isGoingToAuth) {
        final timedOut = await storage.isSessionTimedOut(timeoutMinutes: 30);
        final biometricEnabled = await storage.isBiometricEnabled();
        if (timedOut && biometricEnabled) {
          return AppRoutes.biometricLock;
        }
      }

      if (!isAuthenticated && !isGoingToAuth) {
        return AppRoutes.login;
      }
      return null;
    },

    routes: [
      // ── Auth flow ─────────────────────────────────────────────────────
      GoRoute(
        path: AppRoutes.splash,
        pageBuilder: (_, __) => _fadeTransition(const SplashPage()),
      ),
      GoRoute(
        path: AppRoutes.login,
        pageBuilder: (_, __) => _slideTransition(const LoginPage()),
      ),
      GoRoute(
        path: AppRoutes.register,
        pageBuilder: (_, __) => _slideTransition(const RegisterPage()),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        pageBuilder: (_, __) => _slideTransition(const ForgotPasswordPage()),
      ),
      GoRoute(
        path: AppRoutes.otp,
        pageBuilder: (_, state) => _slideTransition(
          OtpPage(email: state.uri.queryParameters['email'] ?? ''),
        ),
      ),
      GoRoute(
        path: AppRoutes.biometricLock,
        pageBuilder: (_, __) => _fadeTransition(const BiometricLockPage()),
      ),
      GoRoute(
        path: AppRoutes.pinSetup,
        pageBuilder: (_, __) => _slideTransition(const PinSetupPage()),
      ),
      GoRoute(
        path: AppRoutes.passkeyUpsell,
        pageBuilder: (_, __) => _slideTransition(const PasskeyUpsellPage()),
      ),
      GoRoute(
        path: AppRoutes.ekyc,
        pageBuilder: (_, __) => _slideTransition(const EkycPage()),
      ),

      // ── Main app (shell with bottom nav) ──────────────────────────────
      ShellRoute(
        builder: (context, state, child) => MainScaffold(child: child),
        routes: [
          GoRoute(
            path: AppRoutes.dashboard,
            pageBuilder: (_, __) => _noTransition(const DashboardPage()),
          ),
          GoRoute(
            path: AppRoutes.transactions,
            pageBuilder: (_, __) => _noTransition(const TransactionListPage()),
          ),
          GoRoute(
            path: AppRoutes.accounts,
            pageBuilder: (_, __) => _noTransition(const AccountListPage()),
          ),
          GoRoute(
            path: AppRoutes.budget,
            pageBuilder: (_, __) => _noTransition(const BudgetPage()),
          ),
          GoRoute(
            path: AppRoutes.reports,
            pageBuilder: (_, __) => _noTransition(const ReportsPage()),
          ),
          GoRoute(
            path: AppRoutes.settings,
            pageBuilder: (_, __) => _noTransition(const SettingsPage()),
          ),
        ],
      ),

      // ── Full-screen modals ────────────────────────────────────────────
      GoRoute(
        path: AppRoutes.transactionAdd,
        pageBuilder: (_, __) => _bottomSheetTransition(
          const TransactionFormPage(),
        ),
      ),
      GoRoute(
        path: AppRoutes.transactionEdit,
        pageBuilder: (_, state) => _bottomSheetTransition(
          TransactionFormPage(recordId: state.pathParameters['id']),
        ),
      ),
    ],

    errorBuilder: (context, state) => _ErrorPage(error: state.error),
  );
});

// ── Page Transitions ─────────────────────────────────────────────────────────
CustomTransitionPage _fadeTransition(Widget child) {
  return CustomTransitionPage(
    child: child,
    transitionsBuilder: (_, animation, __, child) =>
        FadeTransition(opacity: animation, child: child),
    transitionDuration: const Duration(milliseconds: 400),
  );
}

CustomTransitionPage _slideTransition(Widget child) {
  return CustomTransitionPage(
    child: child,
    transitionsBuilder: (_, animation, __, child) {
      final slide = Tween<Offset>(
        begin: const Offset(1, 0),
        end: Offset.zero,
      ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic));
      return SlideTransition(position: slide, child: child);
    },
    transitionDuration: const Duration(milliseconds: 320),
  );
}

CustomTransitionPage _bottomSheetTransition(Widget child) {
  return CustomTransitionPage(
    child: child,
    transitionsBuilder: (_, animation, __, child) {
      final slide = Tween<Offset>(
        begin: const Offset(0, 1),
        end: Offset.zero,
      ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic));
      return SlideTransition(position: slide, child: child);
    },
    transitionDuration: const Duration(milliseconds: 350),
  );
}

CustomTransitionPage _noTransition(Widget child) {
  return CustomTransitionPage(
    child: child,
    transitionsBuilder: (_, __, ___, child) => child,
  );
}

class _ErrorPage extends StatelessWidget {
  final Exception? error;
  const _ErrorPage({this.error});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text('Oops! ${error?.toString() ?? 'Something went wrong'}'),
      ),
    );
  }
}
