import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Wraps FlutterSecureStorage — stores sensitive data in:
/// - iOS: Keychain (hardware-backed)
/// - Android: EncryptedSharedPreferences / Keystore
///
/// NEVER store tokens in plain SharedPreferences / Hive (unencrypted).
class SecureStorageService {
  final FlutterSecureStorage _storage;

  SecureStorageService()
      : _storage = const FlutterSecureStorage(
          // Android: strongest encryption available
          aOptions: AndroidOptions(
            encryptedSharedPreferences: true,
            sharedPreferencesName: 'budgetbee_secure',
            preferencesKeyPrefix: 'bb_',
          ),
          // iOS: accessible only when device unlocked
          iOptions: IOSOptions(
            accessibility: KeychainAccessibility.first_unlock_this_device,
          ),
        );

  // ── Auth Token ─────────────────────────────────────────────────────────
  static const _keyAccessToken = 'access_token';
  static const _keyRefreshToken = 'refresh_token';
  static const _keyTokenExpiry = 'token_expiry';
  static const _keyUserId = 'user_id';
  static const _keyUserEmail = 'user_email';
  static const _keyUserName = 'user_name';
  static const _keyBiometricEnabled = 'biometric_enabled';
  static const _keyPrivacyMode = 'privacy_mode';
  static const _keyPinHash = 'pin_hash';
  static const _keyPasskeyCredentialId = 'passkey_credential_id';
  static const _keyLastActiveAt = 'last_active_at';

  // ── Token Management ────────────────────────────────────────────────────
  Future<void> saveTokens({
    required String accessToken,
    required String? refreshToken,
    required DateTime expiry,
  }) async {
    await Future.wait([
      _storage.write(key: _keyAccessToken, value: accessToken),
      if (refreshToken != null)
        _storage.write(key: _keyRefreshToken, value: refreshToken),
      _storage.write(
          key: _keyTokenExpiry, value: expiry.toIso8601String()),
    ]);
  }

  Future<String?> getAccessToken() => _storage.read(key: _keyAccessToken);
  Future<String?> getRefreshToken() => _storage.read(key: _keyRefreshToken);

  Future<bool> isTokenExpired() async {
    final expiry = await _storage.read(key: _keyTokenExpiry);
    if (expiry == null) return true;
    return DateTime.now().isAfter(DateTime.parse(expiry));
  }

  // ── User Info ───────────────────────────────────────────────────────────
  Future<void> saveUserInfo({
    required String userId,
    required String email,
    required String name,
  }) async {
    await Future.wait([
      _storage.write(key: _keyUserId, value: userId),
      _storage.write(key: _keyUserEmail, value: email),
      _storage.write(key: _keyUserName, value: name),
    ]);
  }

  Future<String?> getUserId() => _storage.read(key: _keyUserId);
  Future<String?> getUserEmail() => _storage.read(key: _keyUserEmail);
  Future<String?> getUserName() => _storage.read(key: _keyUserName);

  // ── App Lock Settings ───────────────────────────────────────────────────
  Future<void> setBiometricEnabled(bool enabled) =>
      _storage.write(key: _keyBiometricEnabled, value: enabled.toString());

  Future<bool> isBiometricEnabled() async {
    final val = await _storage.read(key: _keyBiometricEnabled);
    return val == 'true';
  }

  Future<void> setPrivacyMode(bool enabled) =>
      _storage.write(key: _keyPrivacyMode, value: enabled.toString());

  Future<bool> isPrivacyMode() async {
    final val = await _storage.read(key: _keyPrivacyMode);
    return val == 'true';
  }

  Future<void> savePinHash(String pinHash) =>
      _storage.write(key: _keyPinHash, value: pinHash);

  Future<String?> getPinHash() => _storage.read(key: _keyPinHash);

  // ── Session Activity ─────────────────────────────────────────────────────
  Future<void> updateLastActive() => _storage.write(
        key: _keyLastActiveAt,
        value: DateTime.now().toIso8601String(),
      );

  Future<bool> isSessionTimedOut({int timeoutMinutes = 30}) async {
    final lastActive = await _storage.read(key: _keyLastActiveAt);
    if (lastActive == null) return true;
    final diff = DateTime.now().difference(DateTime.parse(lastActive));
    return diff.inMinutes >= timeoutMinutes;
  }

  // ── Passkey ─────────────────────────────────────────────────────────────
  Future<void> savePasskeyCredentialId(String credId) =>
      _storage.write(key: _keyPasskeyCredentialId, value: credId);

  Future<String?> getPasskeyCredentialId() =>
      _storage.read(key: _keyPasskeyCredentialId);

  // ── Logout / Clear ───────────────────────────────────────────────────────
  /// Clears auth data but keeps user preferences (biometric, privacy mode)
  Future<void> clearSession() async {
    await Future.wait([
      _storage.delete(key: _keyAccessToken),
      _storage.delete(key: _keyRefreshToken),
      _storage.delete(key: _keyTokenExpiry),
      _storage.delete(key: _keyLastActiveAt),
    ]);
  }

  /// Full wipe — for account deletion or factory reset
  Future<void> clearAll() => _storage.deleteAll();
}

// ── Riverpod Provider ───────────────────────────────────────────────────────
final secureStorageProvider = Provider<SecureStorageService>(
  (_) => SecureStorageService(),
);
