/**
 * PIN hashing helper.
 *
 * Goal: never store the raw PIN on disk, even inside iOS Keychain /
 * Android Keystore. We salt + SHA-256 the PIN with a per-install random
 * salt that lives next to the hash in SecureStore. If an attacker dumps
 * the keystore they get `salt` and `hash(salt + pin)` — they still have
 * to brute-force the 6-digit PIN (10^6 = 1M tries) but cannot recover
 * the raw PIN, and the hash can't be replayed against other installs.
 *
 * Implementation uses `expo-crypto` which delegates to CommonCrypto (iOS)
 * and Android Security crypto — the same native primitives the keystore
 * itself uses. Pure JS so it works in Expo Go without a custom dev build.
 */
import * as Crypto from 'expo-crypto';

/**
 * Encoded form: `v1:<saltHex>:<hashHex>`
 * v1 — versioned in case we ever bump to PBKDF2 / Argon2 native module.
 */
const VERSION = 'v1';

function randomHex(bytes: number): string {
  const arr = Crypto.getRandomBytes(bytes);
  let out = '';
  for (let i = 0; i < arr.length; i++) {
    out += arr[i].toString(16).padStart(2, '0');
  }
  return out;
}

async function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

/**
 * Hash a fresh PIN for storage. Generates a random salt each call.
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomHex(16); // 128-bit salt
  const hash = await sha256Hex(`${salt}:${pin}`);
  return `${VERSION}:${salt}:${hash}`;
}

/**
 * Constant-time-ish compare of a candidate PIN against a previously
 * stored hash. Returns `true` if the candidate matches.
 *
 * Also handles the legacy plaintext format produced by older builds
 * (before this helper existed) so existing users aren't locked out —
 * those entries are migrated to v1 on the next successful unlock by
 * the caller (see `secureStorage.savePinHash`).
 */
export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  // Legacy: pre-hash plaintext (just digits) — accept once so the
  // caller can upgrade the stored value via hashPin().
  if (!stored.startsWith(`${VERSION}:`)) {
    return safeEquals(pin, stored);
  }

  const parts = stored.split(':');
  if (parts.length !== 3) return false;
  const [, salt, expected] = parts;
  const actual = await sha256Hex(`${salt}:${pin}`);
  return safeEquals(actual, expected);
}

/**
 * Returns true if the stored value is in the legacy plaintext format
 * and should be rewritten by the caller after a successful unlock.
 */
export function needsRehash(stored: string | null): boolean {
  return !!stored && !stored.startsWith(`${VERSION}:`);
}

/** Length-safe constant-time-ish string compare. */
function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
