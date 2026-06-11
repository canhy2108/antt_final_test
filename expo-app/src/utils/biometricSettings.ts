/**
 * Deep-link helper that takes the user from BudgetBee straight to the OS
 * screen where biometric enrolment lives. We hit this whenever the user
 * tries to enable/use Face / Fingerprint inside the app but the device
 * has nothing enrolled at the OS level — without this they'd have to
 * close the app, find Settings, drill into "Security" or "Face ID & Code"
 * and come back. Banks like Techcombank, Vietcombank do the same jump.
 *
 * - Android 11+ (API 30+): `Settings.ACTION_BIOMETRIC_ENROLL` lands the
 *   user directly on the "Add fingerprint / Add face" screen.
 *   On older Android the constant doesn't exist; we fall back to the
 *   Security settings page (`Settings.ACTION_SECURITY_SETTINGS`).
 * - iOS: there is no public deep link into the Touch ID / Face ID
 *   settings panel. The honest best-effort is `Linking.openSettings()`,
 *   which opens BudgetBee's Settings entry — the user then taps back
 *   once to reach the main Settings menu and find Face ID & Passcode.
 *   We surface a short hint in the calling UI explaining the next step.
 * - Web: no biometric at all; we just return false so the caller can
 *   keep the fallback path visible.
 */
import { Platform, Linking } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

/** Android Settings activity constants. */
const ANDROID_ACTION_BIOMETRIC_ENROLL = 'android.settings.BIOMETRIC_ENROLL';
const ANDROID_ACTION_SECURITY_SETTINGS = 'android.settings.SECURITY_SETTINGS';
const ANDROID_ACTION_FINGERPRINT_ENROLL = 'android.settings.FINGERPRINT_ENROLL';

export async function openOsBiometricSettings(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    // Try the most specific intent first, fall through to broader ones.
    const candidates = [
      ANDROID_ACTION_BIOMETRIC_ENROLL,   // Android 11+ — exact screen
      ANDROID_ACTION_FINGERPRINT_ENROLL, // Older devices that only have fingerprint
      ANDROID_ACTION_SECURITY_SETTINGS,  // Last resort — Security menu
    ];
    for (const action of candidates) {
      try {
        await IntentLauncher.startActivityAsync(action);
        return true;
      } catch {
        // Activity not found on this OS version, try the next one.
      }
    }
    // All Android intents failed — fall back to opening the app's own
    // Settings entry so the user can at least navigate manually.
    try {
      await Linking.openSettings();
      return true;
    } catch {
      return false;
    }
  }

  // iOS — Apple does not expose a deep link into the Face ID / Touch ID
  // settings. Open the app's Settings entry; the calling UI tells the
  // user to navigate Settings → Face ID & Passcode from there.
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

/**
 * Human-readable hint the calling screen can render next to the "Open
 * Settings" button so iOS users know what to look for. Android lands on
 * the right screen automatically, so the hint is generic there.
 */
export function osBiometricSettingsHint(): string {
  if (Platform.OS === 'ios') {
    return 'Trong Settings → vuốt xuống → Face ID & Passcode (hoặc Touch ID & Passcode) → thêm khuôn mặt / vân tay.';
  }
  if (Platform.OS === 'android') {
    return 'Trong Cài đặt → Bảo mật → thêm vân tay hoặc khuôn mặt.';
  }
  return 'Trên trình duyệt không có sinh trắc học — hãy mở app trên điện thoại.';
}
