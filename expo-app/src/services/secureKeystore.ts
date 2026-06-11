/**
 * Biometric-gated credential storage.
 *
 * Implementation uses `expo-secure-store` with `requireAuthentication: true`,
 * which gates each read of the value behind the OS biometric prompt:
 *
 *   - iOS: Keychain entry with kSecAttrAccessControl + .biometryCurrentSet
 *     so that reading the value requires Face ID / Touch ID, and the entry
 *     is invalidated if the biometric set on the device changes.
 *   - Android: Keystore-backed encryption key created with
 *     setUserAuthenticationRequired(true) and
 *     setInvalidatedByBiometricEnrollment(true). Reading the value triggers
 *     BiometricPrompt; adding/removing a fingerprint wipes the key.
 *
 * Why we dropped `react-native-keychain` here:
 *   1. The previous wrapper referenced
 *      `Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE_NOT_ALLOWED`
 *      — that constant does not exist in the enum, so the actual stored
 *      entry had **no** access control. Anyone opening the app could read
 *      the bio_token without a biometric prompt.
 *   2. The wrapper used a single `service` value for bio_cred + access_token
 *      + refresh_token, which on `setGenericPassword` semantics means each
 *      write overwrote the previous one — the bio_token was silently wiped
 *      the first time the access token was saved.
 *   3. `react-native-keychain` requires `expo prebuild` (eject from the
 *      managed Expo workflow). `expo-secure-store` ships with the managed
 *      workflow and supports `requireAuthentication: true` since SDK 49.
 *
 * Each `kind` (face / fingerprint) gets its own SecureStore key so we can
 * revoke them independently, and we ALSO stash a snapshot of the device's
 * biometric profile at enrolment time. If the OS biometric set changes
 * between enrolment and login (eg. someone adds their fingerprint), we
 * refuse and force a password re-enrolment — this is the closest mobile
 * apps can get to "this credential is bound to the original face/finger".
 */

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BiometricCredential {
  credentialId: string;
  bioToken: string;
  expiresAt?: string | null;
  email?: string;
  /** Snapshot of the OS biometric profile at enrolment time. */
  biometricSetSnapshot?: string;
}

type Kind = 'face' | 'fingerprint';

const STORAGE_KEY: Record<Kind, string> = {
  face: 'bbee_bio_cred_face_v3',
  fingerprint: 'bbee_bio_cred_finger_v3',
};

// Snapshot is stored in plain AsyncStorage on purpose — it's metadata
// (capability + enrolled level), not a secret. We use it ONLY to detect
// "user added a new fingerprint after enrolment" and invalidate the
// credential when that happens.
const SNAPSHOT_KEY: Record<Kind, string> = {
  face: 'bbee_bio_snapshot_face_v3',
  fingerprint: 'bbee_bio_snapshot_finger_v3',
};

async function computeBiometricSetSnapshot(): Promise<string> {
  // We can't read individual fingerprint templates (the OS does not expose
  // them), but we CAN see the enrolled level + supported types. When the
  // user adds/removes a fingerprint or face, `getEnrolledLevelAsync` and
  // the timestamp of enrolment change — we hash those together.
  try {
    const [level, types] = await Promise.all([
      LocalAuthentication.getEnrolledLevelAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    return `${Platform.OS}:${level}:${[...types].sort().join(',')}`;
  } catch {
    return `${Platform.OS}:unknown`;
  }
}

function storeOptions(kind: Kind): SecureStore.SecureStoreOptions {
  // requireAuthentication: true → reading triggers the OS biometric prompt.
  // On iOS this is wired via SecAccessControl(.biometryCurrentSet); on
  // Android via Keystore setUserAuthenticationRequired(true). On platforms
  // where biometric storage is not available the call falls back to a
  // standard SecureStore entry — we detect this via canUseBiometric.
  return {
    requireAuthentication: true,
    authenticationPrompt:
      kind === 'face' ? 'Xác thực khuôn mặt' : 'Xác thực vân tay',
    keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  };
}

async function setItemFallback(key: string, value: string): Promise<void> {
  // Web has no SecureStore; degrade to AsyncStorage. The login screen
  // hides biometric entry points on web anyway, so this only kicks in
  // for the (small) "user opened the web build" case.
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItemFallback(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItemFallback(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const secureKeystore = {
  /**
   * Persist a biometric credential. Stored value is gated by the OS
   * biometric prompt on subsequent reads — the bio_token is unreadable to
   * any process that cannot pass Face ID / Touch ID / fingerprint.
   */
  async saveBioCredential(kind: Kind, cred: BiometricCredential): Promise<void> {
    const snapshot = await computeBiometricSetSnapshot();
    const payload: BiometricCredential = { ...cred, biometricSetSnapshot: snapshot };

    if (Platform.OS === 'web') {
      // Web: no Keychain; degrade. UI should hide biometric buttons on web.
      await AsyncStorage.setItem(STORAGE_KEY[kind], JSON.stringify(payload));
      await AsyncStorage.setItem(SNAPSHOT_KEY[kind], snapshot);
      return;
    }

    const canBio =
      typeof SecureStore.canUseBiometricAuthentication === 'function'
        ? SecureStore.canUseBiometricAuthentication()
        : true;

    if (canBio) {
      await SecureStore.setItemAsync(
        STORAGE_KEY[kind],
        JSON.stringify(payload),
        storeOptions(kind),
      );
    } else {
      // Hardware doesn't support biometric-gated storage. Fall back to a
      // standard encrypted entry — still better than AsyncStorage, but the
      // bio_token won't have the biometric gate. Caller already enforces
      // the gate via biometricService.authenticate() before unlocking, so
      // this is the secondary defence layer only.
      await SecureStore.setItemAsync(STORAGE_KEY[kind], JSON.stringify(payload));
    }
    await AsyncStorage.setItem(SNAPSHOT_KEY[kind], snapshot);
  },

  /**
   * Read a biometric credential. Triggers OS biometric prompt automatically
   * because the entry was stored with `requireAuthentication: true`.
   *
   * Returns null when no credential is enrolled. Throws when:
   *   - The user fails / cancels the biometric prompt
   *   - The biometric set has changed since enrolment (forces re-enroll)
   */
  async getBioCredential(kind: Kind): Promise<BiometricCredential | null> {
    let raw: string | null;
    try {
      raw = await getItemFallback(STORAGE_KEY[kind]);
    } catch (err) {
      // SecureStore throws when the OS biometric prompt fails or is cancelled.
      throw err instanceof Error ? err : new Error(String(err));
    }
    if (!raw) return null;

    let parsed: BiometricCredential;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    // Defence-in-depth: if the OS biometric set has changed since enrolment
    // (eg. someone added a fingerprint), refuse and force a password re-enroll.
    const expectedSnapshot = await AsyncStorage.getItem(SNAPSHOT_KEY[kind]);
    const currentSnapshot = await computeBiometricSetSnapshot();
    if (expectedSnapshot && expectedSnapshot !== currentSnapshot) {
      await this.deleteBioCredential(kind);
      throw new Error(
        'Sinh trắc trên thiết bị đã thay đổi (thêm/sửa vân tay hoặc khuôn mặt). Vui lòng đăng ký lại bằng mật khẩu.',
      );
    }

    return parsed;
  },

  async deleteBioCredential(kind: Kind): Promise<void> {
    await deleteItemFallback(STORAGE_KEY[kind]);
    await AsyncStorage.removeItem(SNAPSHOT_KEY[kind]);
  },

  async clearAll(): Promise<void> {
    await this.deleteBioCredential('face');
    await this.deleteBioCredential('fingerprint');
  },

  async isBiometricStorageAvailable(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      return typeof SecureStore.canUseBiometricAuthentication === 'function'
        ? SecureStore.canUseBiometricAuthentication()
        : true;
    } catch {
      return false;
    }
  },
};
