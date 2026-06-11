import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Stable per-install device fingerprint. Used to bind biometric credentials
 * to a specific device — the server stores this fingerprint with each
 * credential row so a stolen bio_token from one phone cannot be replayed
 * from another phone.
 *
 * Implementation: a v4-style 128-bit random value, generated once per
 * install and persisted in the OS keystore (iOS Keychain / Android Keystore).
 * On reinstall the user re-enrolls — which is the expected security UX
 * (a new install of the app should not inherit biometric trust).
 */
const KEY = 'device_fingerprint_v1';

function randomFingerprint(): string {
  // 16 bytes (128 bits) → 32 hex chars. Sufficiently unique for the server's
  // (user, fp, kind) unique key without leaking IDFV / ANDROID_ID raw.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    // RN 0.81+ ships Web Crypto on global; fallback only for older RN.
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

async function readStored(): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(KEY);
  return SecureStore.getItemAsync(KEY);
}

async function writeStored(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(KEY, value);
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
}

let cached: string | null = null;

export const deviceFingerprint = {
  /** Returns the stable fingerprint, creating + persisting it on first call. */
  async get(): Promise<string> {
    if (cached) return cached;
    let fp = await readStored();
    if (!fp) {
      fp = randomFingerprint();
      await writeStored(fp);
    }
    cached = fp;
    return fp;
  },

  /** Wipe — used when the user explicitly factory-resets the app. */
  async reset(): Promise<void> {
    cached = null;
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(KEY);
      return;
    }
    await SecureStore.deleteItemAsync(KEY);
  },
};
