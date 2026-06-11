/**
 * Per-user biometric registry — local metadata about which emails on this
 * device have enrolled a face or fingerprint.
 *
 * Phase A security tightening:
 *   - The previous version persisted each user's plaintext BudgetBee
 *     password in SecureStore (`bio_pw_<email>`) so a "biometric fast
 *     login" could replay it. That slot was never actually READ anywhere
 *     in the code (grep for `userBiometricService.getPassword` returns
 *     only the definition), so it was pure attack surface: a rooted
 *     phone, malicious backup extraction, or a leaked Keychain dump
 *     would have exposed the user's password in cleartext.
 *   - We now ONLY persist enrolment metadata (faceEnrolledAt /
 *     fingerEnrolledAt). The real authentication factor is the
 *     biometric-gated bio_token in `secureKeystore`. Password is never
 *     persisted locally for biometric replay; the user re-enters it only
 *     when explicitly re-enrolling.
 *   - On first read after upgrade we also scrub any legacy `bio_pw_*`
 *     SecureStore entries left over from older installs.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REGISTRY_KEY = 'bio_registry_v2';
const LEGACY_SCRUB_FLAG = 'bio_legacy_password_scrubbed_v1';

export interface BioRecord {
  email: string;
  /** Wall-clock timestamp when face was last enrolled. */
  faceEnrolledAt?: number;
  /** Duration of the face scan in ms (signature-like, per-user demo seed). */
  faceScanMs?: number;
  /** Hold duration in ms recorded during fingerprint enrolment. */
  fingerHoldMs?: number;
  fingerEnrolledAt?: number;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function loadRegistry(): Promise<Record<string, BioRecord>> {
  try {
    const raw = await AsyncStorage.getItem(REGISTRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveRegistry(reg: Record<string, BioRecord>): Promise<void> {
  await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
}

/** Legacy key shape from the cleartext-password era. */
function legacyPwKeyFor(email: string): string {
  return 'bio_pw_' + normalizeEmail(email).replace(/[^a-z0-9]/g, '_');
}

/**
 * One-time cleanup: delete any leftover `bio_pw_*` SecureStore entries
 * from older installs. Guarded by a flag so we only do it once.
 */
async function scrubLegacyPasswords(emails: string[]): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const flagged = await AsyncStorage.getItem(LEGACY_SCRUB_FLAG);
    if (flagged === 'done') return;
    await Promise.all(
      emails.map(async (email) => {
        try {
          await SecureStore.deleteItemAsync(legacyPwKeyFor(email));
        } catch {
          /* never throws — just best-effort */
        }
      }),
    );
    await AsyncStorage.setItem(LEGACY_SCRUB_FLAG, 'done');
  } catch {
    /* swallow — scrub is best-effort */
  }
}

export const userBiometricService = {
  /**
   * Mark `email` as having enrolled a face on this device. We do not store
   * the image, the password, or any biometric template — those either live
   * in the OS Secure Enclave (real biometric data) or in `secureKeystore`
   * gated by OS biometric (the bio_token).
   */
  async enrollFace(email: string, scanMs: number): Promise<void> {
    const key = normalizeEmail(email);
    const reg = await loadRegistry();
    reg[key] = {
      ...(reg[key] ?? { email: key }),
      email: key,
      faceEnrolledAt: Date.now(),
      faceScanMs: scanMs,
    };
    await saveRegistry(reg);
    await scrubLegacyPasswords(Object.keys(reg));
  },

  /** Mark `email` as having enrolled a fingerprint on this device. */
  async enrollFingerprint(email: string, holdMs: number): Promise<void> {
    const key = normalizeEmail(email);
    const reg = await loadRegistry();
    reg[key] = {
      ...(reg[key] ?? { email: key }),
      email: key,
      fingerHoldMs: holdMs,
      fingerEnrolledAt: Date.now(),
    };
    await saveRegistry(reg);
    await scrubLegacyPasswords(Object.keys(reg));
  },

  async getRecord(email: string): Promise<BioRecord | null> {
    const reg = await loadRegistry();
    return reg[normalizeEmail(email)] ?? null;
  },

  /** Returns ALL users that have at least one form of biometric enrolled. */
  async listEnrolled(): Promise<BioRecord[]> {
    const reg = await loadRegistry();
    return Object.values(reg).filter((u) => u.faceEnrolledAt || u.fingerEnrolledAt);
  },

  async hasFace(email: string): Promise<boolean> {
    const rec = await this.getRecord(email);
    return !!rec?.faceEnrolledAt;
  },

  async hasFingerprint(email: string): Promise<boolean> {
    const rec = await this.getRecord(email);
    return !!rec?.fingerEnrolledAt;
  },

  /** Drop a single user's biometric metadata. */
  async removeUser(email: string): Promise<void> {
    const key = normalizeEmail(email);
    const reg = await loadRegistry();
    delete reg[key];
    await saveRegistry(reg);
    await scrubLegacyPasswords([key]);
  },

  async unenrollFace(email: string): Promise<void> {
    const key = normalizeEmail(email);
    const reg = await loadRegistry();
    if (reg[key]) {
      delete reg[key].faceEnrolledAt;
      delete reg[key].faceScanMs;
      await saveRegistry(reg);
    }
  },

  async unenrollFingerprint(email: string): Promise<void> {
    const key = normalizeEmail(email);
    const reg = await loadRegistry();
    if (reg[key]) {
      delete reg[key].fingerHoldMs;
      delete reg[key].fingerEnrolledAt;
      await saveRegistry(reg);
    }
  },

  /**
   * Trigger the legacy password scrub explicitly. Safe to call on app
   * startup — only does work once (gated by an AsyncStorage flag).
   */
  async scrubLegacyData(): Promise<void> {
    const reg = await loadRegistry();
    await scrubLegacyPasswords(Object.keys(reg));
  },
};
