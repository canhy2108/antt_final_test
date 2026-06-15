import axios from 'axios';
import { apiClient } from './client';
import { User } from '@/types';
import { secureStorage } from '@/services/secureStorage';
import { deviceFingerprint } from '@/services/deviceFingerprint';
import BiometricNative from '@/native/BiometricNative';

/**
 * Hardware-backed biometric login (Phase B).
 *
 * Uses the native module in `src/native/BiometricModule.{kt,swift}` which
 * generates a P-256 keypair inside StrongBox (Android) / Secure Enclave
 * (iOS) with `setUserAuthenticationRequired(true)` +
 * `setInvalidatedByBiometricEnrollment(true)`. The private key NEVER
 * leaves hardware. Even root cannot extract it.
 *
 * Flow:
 *   1. enroll() — user is password-logged-in
 *      → call BiometricNative.enroll(alias) which generates the keypair
 *        in-enclave and returns the base64 public key
 *      → POST /biometric/keys/register with the public key
 *   2. login() — public flow
 *      → POST /biometric/keys/challenge → server returns a 32-byte nonce
 *      → call BiometricNative.sign(challenge) — OS biometric prompt fires
 *        as part of unlocking the in-enclave key, signature is computed
 *        inside the secure boundary
 *      → POST /biometric/keys/verify with the signature
 *
 * Compared to Phase A (`biometric.ts`):
 *   - There is no opaque token to steal — only a hardware-bound private key.
 *   - The signature is over a server-issued one-shot nonce, so even a
 *     captured network packet cannot be replayed.
 *   - When the user adds a fingerprint to the device, the key is
 *     auto-invalidated by `setInvalidatedByBiometricEnrollment(true)` —
 *     the next sign attempt fails and the client re-enrols via password.
 *
 * Native registration is required for this to work:
 *   - Android: add `BiometricPackage` to MainApplication.kt
 *     (see `src/native/IMPLEMENTATION.md` and `WIRE_NATIVE.md`)
 *   - iOS: add `BiometricHardware.swift` to Xcode project + bridging header
 *     (see `WIRE_NATIVE.md`)
 *
 * If the native module is not registered, all calls throw with
 * "BiometricHardware native module not installed" — the caller should
 * fall back to Phase A (`biometricApi`).
 */

interface VerifyResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: { id: string | number; name: string; email: string };
  matched_by: 'face' | 'fingerprint';
}

interface ChallengeResponse {
  nonce: string;
  expires_in: number;
  algorithm: string;
}

function aliasFor(kind: 'face' | 'fingerprint'): string {
  return `budgetbee_${kind}_v1`;
}

function laravelErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && err.response) {
    const data = err.response.data as any;
    if (data?.errors && typeof data.errors === 'object') {
      const first = Object.values(data.errors)[0];
      if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
    }
    if (typeof data?.message === 'string') return data.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

async function persistAuth(payload: VerifyResponse): Promise<User> {
  await secureStorage.saveTokens({
    accessToken: payload.access_token,
    expiry: new Date(Date.now() + (payload.expires_in ?? 1800) * 1000),
  });
  await secureStorage.saveUserInfo({
    userId: String(payload.user.id),
    email: payload.user.email,
    name: payload.user.name,
  });
  return {
    id: String(payload.user.id),
    name: payload.user.name,
    email: payload.user.email,
  } as User;
}

export const biometricKeysApi = {
  /** Returns true if the native module is available on this device. */
  async isAvailable(): Promise<boolean> {
    try {
      await BiometricNative.canAuthenticate();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Enrol a hardware-backed key for the currently-logged-in user. The
   * private key is generated inside Secure Enclave / StrongBox with
   * biometric-required access; only the public key reaches the server.
   */
  async enroll(kind: 'face' | 'fingerprint'): Promise<{ deviceKeyId: number }> {
    const alias = aliasFor(kind);
    let publicKey: string;
    try {
      const r = await BiometricNative.enroll({ algorithm: 'ES256', requireStrongBox: true });
      publicKey = r.publicKey;
    } catch (err: any) {
      throw new Error(
        err?.message ??
          'Không tạo được khoá phần cứng — vui lòng kiểm tra cài đặt sinh trắc thiết bị.',
      );
    }

    const fp = await deviceFingerprint.get();

    try {
      const res = await apiClient.post<{ device_key_id: number }>(
        '/biometric/keys/register',
        {
          device_fingerprint: fp,
          kind,
          alias,
          public_key: publicKey,
          algorithm: 'ES256',
        },
      );
      return { deviceKeyId: res.data.device_key_id };
    } catch (err) {
      throw new Error(laravelErrorMessage(err, 'Không đăng ký được public key lên server'));
    }
  },

  /**
   * Login using the hardware-backed key. Flow: server issues nonce → OS
   * biometric prompt fires → key signs nonce in-enclave → server verifies.
   */
  async login(kind: 'face' | 'fingerprint'): Promise<{ user: User; matchedBy: 'face' | 'fingerprint' }> {
    const alias = aliasFor(kind);
    const fp = await deviceFingerprint.get();

    let challenge: ChallengeResponse;
    try {
      const res = await apiClient.post<ChallengeResponse>('/biometric/keys/challenge', {
        device_fingerprint: fp,
        kind,
        alias,
      });
      challenge = res.data;
    } catch (err) {
      throw new Error(laravelErrorMessage(err, 'Không lấy được nonce sinh trắc'));
    }

    let signature: string;
    try {
      const r = await BiometricNative.sign(challenge.nonce);
      signature = r.signature;
    } catch (err: any) {
      // Includes user-cancel, lockout, key-invalidated (biometric set changed)
      throw new Error(err?.message ?? 'Xác thực sinh trắc thất bại');
    }

    try {
      const res = await apiClient.post<VerifyResponse>('/biometric/keys/verify', {
        device_fingerprint: fp,
        kind,
        alias,
        nonce: challenge.nonce,
        signature,
      });
      const user = await persistAuth(res.data);
      return { user, matchedBy: kind };
    } catch (err) {
      throw new Error(laravelErrorMessage(err, 'Sinh trắc không khớp với tài khoản'));
    }
  },
};
