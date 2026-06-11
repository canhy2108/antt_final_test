import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { hashPin } from '@/utils/pinCrypto';

const KEYS = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  tokenExpiry: 'token_expiry',
  userId: 'user_id',
  userEmail: 'user_email',
  userName: 'user_name',
  biometricEnabled: 'biometric_enabled',
  // Track which biometric method the user enrolled. Either can satisfy
  // "biometricEnabled" — these flags are mostly for UX display (show
  // ✓ next to the matching option in the chooser screen).
  faceEnrolled: 'bio_face_enrolled',
  fingerprintEnrolled: 'bio_finger_enrolled',
  // Device-bound biometric credentials issued by the server. We keep ONE
  // entry per (kind, email) so multiple accounts on the same device each
  // have their own credential bound by the OS keystore. The value is a JSON
  // blob: { credentialId, bioToken, expiresAt }.
  bioCredFace: 'bio_cred_face_v2',
  bioCredFinger: 'bio_cred_finger_v2',
  privacyMode: 'privacy_mode',
  pinHash: 'pin_hash',
  lastActiveAt: 'last_active_at',
};

const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string) {
  if (isWeb) return AsyncStorage.setItem(key, value);
  return SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (isWeb) return AsyncStorage.removeItem(key);
  return SecureStore.deleteItemAsync(key);
}

export interface BioCredential {
  credentialId: number;
  bioToken: string;
  expiresAt: string | null;
  email: string;
}

function bioKey(kind: 'face' | 'fingerprint'): string {
  return kind === 'face' ? KEYS.bioCredFace : KEYS.bioCredFinger;
}

export const secureStorage = {
  async saveTokens(opts: { accessToken: string; refreshToken?: string | null; expiry: Date }) {
    await setItem(KEYS.accessToken, opts.accessToken);
    if (opts.refreshToken) await setItem(KEYS.refreshToken, opts.refreshToken);
    await setItem(KEYS.tokenExpiry, opts.expiry.toISOString());
  },
  getAccessToken: () => getItem(KEYS.accessToken),
  getRefreshToken: () => getItem(KEYS.refreshToken),
  async isTokenExpired() {
    const expiry = await getItem(KEYS.tokenExpiry);
    if (!expiry) return true;
    return new Date() > new Date(expiry);
  },

  async saveUserInfo(opts: { userId: string; email: string; name: string }) {
    await setItem(KEYS.userId, opts.userId);
    await setItem(KEYS.userEmail, opts.email);
    await setItem(KEYS.userName, opts.name);
  },
  getUserId: () => getItem(KEYS.userId),
  getUserEmail: () => getItem(KEYS.userEmail),
  getUserName: () => getItem(KEYS.userName),

  setBiometricEnabled: (v: boolean) => setItem(KEYS.biometricEnabled, String(v)),
  async isBiometricEnabled() {
    return (await getItem(KEYS.biometricEnabled)) === 'true';
  },

  /**
   * Persist a server-issued bio credential, keyed by kind. The value is
   * kept in Keychain/Keystore so OS-level access protection covers it.
   * On RN/Expo we don't currently set `requireAuthentication` (it forces
   * an extra OS prompt and was not used previously); the OS biometric
   * prompt is done explicitly via `expo-local-authentication` before
   * each retrieval, see biometricApi.loginByFace.
   */
  async saveBioCredential(kind: 'face' | 'fingerprint', payload: BioCredential): Promise<void> {
    await setItem(bioKey(kind), JSON.stringify(payload));
  },

  async getBioCredential(kind: 'face' | 'fingerprint'): Promise<BioCredential | null> {
    const raw = await getItem(bioKey(kind));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (
        typeof parsed?.credentialId === 'number' &&
        typeof parsed?.bioToken === 'string' &&
        typeof parsed?.email === 'string'
      ) {
        return parsed as BioCredential;
      }
    } catch {}
    return null;
  },

  async clearBioCredential(kind: 'face' | 'fingerprint'): Promise<void> {
    await deleteItem(bioKey(kind));
  },

  async clearAllBioCredentials(): Promise<void> {
    await deleteItem(KEYS.bioCredFace);
    await deleteItem(KEYS.bioCredFinger);
  },

  setFaceEnrolled: (v: boolean) => setItem(KEYS.faceEnrolled, String(v)),
  async isFaceEnrolled() {
    return (await getItem(KEYS.faceEnrolled)) === 'true';
  },

  setFingerprintEnrolled: (v: boolean) => setItem(KEYS.fingerprintEnrolled, String(v)),
  async isFingerprintEnrolled() {
    return (await getItem(KEYS.fingerprintEnrolled)) === 'true';
  },

  setPrivacyMode: (v: boolean) => setItem(KEYS.privacyMode, String(v)),
  async isPrivacyMode() {
    return (await getItem(KEYS.privacyMode)) === 'true';
  },

  /**
   * Persist a PIN. Caller passes the raw 6-digit PIN — this method hashes
   * it with a per-install random salt before writing. The method name is
   * kept as `savePinHash` for backwards compat with the existing call sites,
   * but the input is now always treated as plaintext to hash. Callers must
   * never write a pre-hashed value here.
   */
  async savePinHash(rawPin: string): Promise<void> {
    const stored = await hashPin(rawPin);
    await setItem(KEYS.pinHash, stored);
  },
  /** Returns the stored hash blob (or legacy plaintext for older installs). */
  getPinHash: () => getItem(KEYS.pinHash),
  /** Force-write a pre-computed stored value. Used by the legacy migration path. */
  writeRawPinHash: (stored: string) => setItem(KEYS.pinHash, stored),

  updateLastActive: () => setItem(KEYS.lastActiveAt, new Date().toISOString()),
  async isSessionTimedOut(timeoutMinutes = 30) {
    const last = await getItem(KEYS.lastActiveAt);
    if (!last) return true;
    return (Date.now() - new Date(last).getTime()) / 60000 >= timeoutMinutes;
  },

  async clearSession() {
    await deleteItem(KEYS.accessToken);
    await deleteItem(KEYS.refreshToken);
    await deleteItem(KEYS.tokenExpiry);
    await deleteItem(KEYS.lastActiveAt);
  },

  async clearAll() {
    for (const key of Object.values(KEYS)) await deleteItem(key);
  },
};
