import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:google_fonts/google_fonts.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Disabled runtime font fetching — on emulators / restricted networks the
  // gstatic.com download blocks the main thread waiting for the TCP timeout,
  // triggering Android's "App isn't responding" dialog. Roboto fallback ships
  // with Flutter and is good enough until we bundle Inter into assets/.
  GoogleFonts.config.allowRuntimeFetching = false;

  // Lock portrait orientation (fintech apps rarely need landscape)
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Status bar: dark icons on light background
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
  ));

  runApp(
    // ProviderScope: root of all Riverpod providers
    const ProviderScope(
      child: BudgetBeeApp(),
    ),
  );
}

class BudgetBeeApp extends ConsumerWidget {
  const BudgetBeeApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'BudgetBee',
      debugShowCheckedModeBanner: false,

      // ── Themes ──────────────────────────────────────────────────────
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system, // follow device setting

      // ── i18n — QUAN TRỌNG: phải có delegates để TextField hoạt động ──
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      locale: const Locale('vi', 'VN'),
      supportedLocales: const [
        Locale('vi', 'VN'),
        Locale('en', 'US'),
      ],

      // ── Router ──────────────────────────────────────────────────────
      routerConfig: router,

      // ── App-wide Security: blur on background ───────────────────────
      builder: (context, child) {
        return _AppSecurityWrapper(child: child!);
      },
    );
  }
}

/// Secures app when backgrounded (prevents OS screenshot in app switcher)
class _AppSecurityWrapper extends StatefulWidget {
  final Widget child;
  const _AppSecurityWrapper({required this.child});

  @override
  State<_AppSecurityWrapper> createState() => _AppSecurityWrapperState();
}

class _AppSecurityWrapperState extends State<_AppSecurityWrapper>
    with WidgetsBindingObserver {
  bool _obscured = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Blur screen when app goes to background → prevents OS screenshot
    setState(() {
      _obscured = state == AppLifecycleState.hidden ||
          state == AppLifecycleState.paused;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        // App switcher blur overlay
        if (_obscured)
          Positioned.fill(
            child: Container(
              color: AppTheme.lightTheme.scaffoldBackgroundColor,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: const Color(0xFFBDE83E),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: const Icon(
                        Icons.savings_rounded,
                        color: Color(0xFF111111),
                        size: 44,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'BudgetBee',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF111111),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
