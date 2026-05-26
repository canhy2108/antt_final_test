import 'package:local_auth/local_auth.dart';
import 'package:local_auth/error_codes.dart' as auth_error;
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Handles FaceID / TouchID / Fingerprint authentication, falling back to
/// the device PIN/pattern/password when no biometric is enrolled.
///
/// Private key stays in Keychain/Keystore — never in memory.
class BiometricService {
  final LocalAuthentication _auth = LocalAuthentication();

  /// Coarse "is biometric usable" check.
  ///
  /// Returns true if the device EITHER has biometric hardware with
  /// enrolled credentials OR has a device-credential (PIN/pattern/password)
  /// set up. The previous version returned true only for hardware-with-bio,
  /// which made the feature unusable on emulators and on devices where the
  /// user prefers PIN over fingerprint.
  Future<bool> isAvailable() async {
    final cap = await getCapability();
    return cap == BiometricCapability.biometric ||
        cap == BiometricCapability.deviceCredential;
  }

  /// Granular capability detection so the UI can show a helpful message
  /// when biometric isn't possible (e.g. emulator with no PIN).
  Future<BiometricCapability> getCapability() async {
    try {
      final isSupported = await _auth.isDeviceSupported();
      if (!isSupported) return BiometricCapability.unavailable;

      // canCheckBiometrics is true only when biometric hw exists AND at
      // least one credential is enrolled.
      final canCheckBio = await _auth.canCheckBiometrics;
      if (canCheckBio) {
        final enrolled = await _auth.getAvailableBiometrics();
        if (enrolled.isNotEmpty) return BiometricCapability.biometric;
      }

      // No biometric → see if at least device credential is set up. We
      // can't query this directly without triggering a prompt, so we
      // assume isDeviceSupported() == true means a lock screen exists.
      // (local_auth requires a secure lock to function at all.)
      return BiometricCapability.deviceCredential;
    } on PlatformException catch (_) {
      return BiometricCapability.unavailable;
    } catch (_) {
      return BiometricCapability.unavailable;
    }
  }

  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _auth.getAvailableBiometrics();
    } catch (_) {
      return [];
    }
  }

  /// Authenticate — biometric when available, device PIN/pattern as fallback.
  Future<BiometricResult> authenticate({
    String reason = 'Xác thực để vào BudgetBee',
    bool useErrorDialogs = true,
  }) async {
    try {
      final cap = await getCapability();
      if (cap == BiometricCapability.unavailable) {
        return BiometricResult.notAvailable;
      }

      final authenticated = await _auth.authenticate(
        localizedReason: reason,
        options: AuthenticationOptions(
          stickyAuth: true,           // keeps prompt if user switches app
          biometricOnly: false,        // allow device PIN as fallback
          useErrorDialogs: useErrorDialogs,
          sensitiveTransaction: true,  // stronger prompt label on Android
        ),
      );

      return authenticated
          ? BiometricResult.success
          : BiometricResult.failed;
    } on PlatformException catch (e) {
      // local_auth ships well-known error codes — match on those instead
      // of string-sniffing the toString() output (locale-sensitive).
      switch (e.code) {
        case auth_error.notEnrolled:
          return BiometricResult.notEnrolled;
        case auth_error.lockedOut:
        case auth_error.permanentlyLockedOut:
          return BiometricResult.lockedOut;
        case auth_error.notAvailable:
        case auth_error.passcodeNotSet:
          return BiometricResult.notAvailable;
        case auth_error.otherOperatingSystem:
          return BiometricResult.notAvailable;
        default:
          return BiometricResult.error;
      }
    } catch (_) {
      return BiometricResult.error;
    }
  }

  Future<void> cancelAuthentication() async {
    try {
      await _auth.stopAuthentication();
    } catch (_) {
      // Stopping a non-running auth flow throws on some platforms — ignore.
    }
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

/// What the device can do for app-lock authentication.
enum BiometricCapability {
  /// Hardware sensor available AND at least one biometric enrolled.
  biometric,

  /// No biometric enrolled but device has PIN / pattern / password.
  deviceCredential,

  /// No lock screen / no secure hardware (emulator without PIN, etc.).
  unavailable,
}

// ── Riverpod Provider ────────────────────────────────────────────────────────
final biometricServiceProvider = Provider<BiometricService>(
  (_) => BiometricService(),
);
