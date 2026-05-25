import 'package:local_auth/local_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Handles FaceID / TouchID / Fingerprint authentication.
/// Private key stays in Keychain/Keystore — never in memory.
class BiometricService {
  final LocalAuthentication _auth = LocalAuthentication();

  /// Check if device supports biometric and has enrolled credentials
  Future<bool> isAvailable() async {
    try {
      final canCheck = await _auth.canCheckBiometrics;
      final isDeviceSupported = await _auth.isDeviceSupported();
      return canCheck && isDeviceSupported;
    } catch (_) {
      return false;
    }
  }

  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _auth.getAvailableBiometrics();
    } catch (_) {
      return [];
    }
  }

  /// Authenticate with biometric — used on app resume after timeout
  Future<BiometricResult> authenticate({
    String reason = 'Xác thực để vào BudgetBee',
    bool useErrorDialogs = true,
  }) async {
    try {
      final available = await isAvailable();
      if (!available) return BiometricResult.notAvailable;

      final authenticated = await _auth.authenticate(
        localizedReason: reason,
        options: AuthenticationOptions(
          stickyAuth: true,          // keeps prompt if user switches app
          biometricOnly: false,       // allows device PIN as fallback
          useErrorDialogs: useErrorDialogs,
          sensitiveTransaction: true, // stronger prompt label on Android
        ),
      );

      return authenticated
          ? BiometricResult.success
          : BiometricResult.failed;
    } on Exception catch (e) {
      if (e.toString().contains('NotEnrolled')) {
        return BiometricResult.notEnrolled;
      }
      if (e.toString().contains('LockedOut') ||
          e.toString().contains('PermanentlyLockedOut')) {
        return BiometricResult.lockedOut;
      }
      return BiometricResult.error;
    }
  }

  Future<void> cancelAuthentication() async {
    await _auth.stopAuthentication();
  }
}

enum BiometricResult {
  success,
  failed,
  notAvailable,
  notEnrolled,
  lockedOut,
  error,
}

// ── Riverpod Provider ────────────────────────────────────────────────────────
final biometricServiceProvider = Provider<BiometricService>(
  (_) => BiometricService(),
);
