import axios from 'axios';
import { apiClient } from './client';
import { User } from '@/types';
import { secureStorage } from '@/services/secureStorage';
import { secureKeystore } from '@/services/secureKeystore';
import { deviceFingerprint } from '@/services/deviceFingerprint';
import { biometricService } from '@/services/biometric';

/**
 * Device-bound biometric login (FIDO / WebAuthn-style, Phase A).
 *
 * Threat model (what this phase defends against):
 *   - Old server logic "match the most-recently-enrolled face" / "match the
 *     closest hold-time" let any scan log in as a random user. Replaced
 *     with a cryptographically random `bio_token` bound to (user, device,
 *     kind), persisted only as a SHA-256 hash on the server.
 *   - The bio_token is stored client-side in iOS Keychain / Android
 *     Keystore via `expo-secure-store` with `requireAuthentication: true`
 *     — every retrieval triggers the OS biometric prompt automatically.
 *   - We also stash a snapshot of the OS biometric set at enrolment; if
 *     the user adds a fingerprint or face afterwards, the credential is
 *     invalidated and they must re-enrol via password.
 *
 * Known gaps (Phase B will close):
 *   - The bio_token is opaque, not signed. A rooted device that can
 *     extract the token can still replay it. Phase B replaces this with
 *     ECDSA-P256 challenge-response keys generated inside StrongBox /
 *     Secure Enclave; the private key never leaves hardware.
 *   - The OS biometric prompt verifies "any enrolled face/finger", not
 *     "the BudgetBee account owner". A shared device with multiple
 *     enrolled faces still lets any of them past. The snapshot check above
 *     catches *changes* to the enrolled set, but not multi-enrolment at
 *     enrolment time. Phase C (server-side InsightFace embeddings) is the
 *     only honest fix for that.
 */

interface ServerLoginResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: { id: string | number; name: string; email: string };
  matched_by: 'face' | 'fingerprint';
}

interface EnrollResponse {
  message: string;
  credential_id: number;
  bio_token: string;
  expires_at: string | null;
  kind: 'face' | 'fingerprint';
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

async function persistAuth(payload: ServerLoginResponse): Promise<User> {
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

/**
 * Decide which device-bound credential to use for login.
 *
 * QUAN TRỌNG: trả về kind ĐÃ THỰC SỰ đăng ký trên thiết bị (đọc từ cờ
 * enrolment) — KHÔNG đoán lại bằng `biometricService.primaryKind()`.
 *
 * Vì sao (bug "mặt và vân tay đè/lẫn nhau"): primaryKind() suy ra từ
 * supportedAuthenticationTypesAsync() = modality PHẦN CỨNG hỗ trợ, không phải
 * cái user đăng ký. Đa số máy Android báo có cả mặt lẫn vân tay dù chỉ đăng ký
 * vân tay, nên primaryKind() lật login sang ô 'face' trong khi credential nằm ở
 * ô 'fingerprint' (hoặc ngược lại) → hai ô che/đè nhau. Đọc đúng cờ enrolment
 * loại bỏ việc đoán. Sau bản vá ở enroll() bên dưới, tối đa CHỈ một cờ được bật.
 */
async function resolveEnrolledKind(): Promise<'face' | 'fingerprint' | null> {
  const [face, finger] = await Promise.all([
    secureStorage.isFaceEnrolled(),
    secureStorage.isFingerprintEnrolled(),
  ]);
  if (face) return 'face';
  if (finger) return 'fingerprint';
  return null;
}

async function enroll(kind: 'face' | 'fingerprint', label?: string): Promise<{ credentialId: number }> {
  // Single OS biometric prompt for the whole enrolment.
  //
  // The earlier version ran an explicit OS biometric check here AND then wrote
  // to SecureStore with `requireAuthentication: true` — which on Android
  // creates a Keystore key bound to the biometric session and triggers a
  // second prompt the moment the key is generated. Two prompts = "scan twice".
  //
  // Now: the password screen already confirmed account ownership, and the
  // single biometric prompt fires inside `saveBioCredential` (Android) /
  // on the first read on iOS. Caller is responsible for having verified
  // the user with their password before invoking this.
  const fp = await deviceFingerprint.get();
  const email = (await secureStorage.getUserEmail()) ?? '';

  try {
    const res = await apiClient.post<EnrollResponse>(`/biometric/enroll-${kind}`, {
      device_fingerprint: fp,
      label: label ?? null,
    });

    // Store credential in OS Keystore with biometric-required access. On
    // Android this is where the OS biometric prompt fires (key bind);
    // on iOS the prompt fires lazily on the first read. Every future read
    // triggers Face ID / Touch ID before returning the token.
    await secureKeystore.saveBioCredential(kind, {
      credentialId: String(res.data.credential_id),
      bioToken: res.data.bio_token,
      expiresAt: res.data.expires_at,
      email,
    });

    // HỢP NHẤT VỀ MỘT CREDENTIAL DUY NHẤT.
    // Sau khi lưu kind được chọn, XÓA ô đối diện (credential + cờ) để ô mặt và
    // vân tay không bao giờ tồn tại song song và đè trạng thái của nhau. Đây là
    // bản vá cốt lõi cho bug "quét vân tay và mặt bị trùng / ghi đè": cửa sổ OS
    // chấp nhận đúng thứ user đã đăng ký nên một ô là đủ.
    if (kind === 'face') {
      await secureStorage.setFaceEnrolled(true);
      await secureKeystore.deleteBioCredential('fingerprint');
      await secureStorage.setFingerprintEnrolled(false);
    } else {
      await secureStorage.setFingerprintEnrolled(true);
      await secureKeystore.deleteBioCredential('face');
      await secureStorage.setFaceEnrolled(false);
    }
    await secureStorage.setBiometricEnabled(true);
    return { credentialId: res.data.credential_id };
  } catch (err) {
    throw new Error(laravelErrorMessage(err, 'Không đăng ký được sinh trắc lên server'));
  }
}

async function login(kind: 'face' | 'fingerprint'): Promise<{ user: User; matchedBy: 'face' | 'fingerprint' }> {
  // Retrieving the credential auto-fires the OS biometric prompt (because
  // we stored it with requireAuthentication=true). The prompt also acts
  // as our explicit "is the right person here?" check.
  let cred;
  try {
    cred = await secureKeystore.getBioCredential(kind);
  } catch (err: any) {
    // Includes: user cancelled, biometric lockout, biometric set changed
    // (which wipes the credential), unsupported hardware.
    throw new Error(
      err?.message ??
        'Xác thực sinh trắc thất bại — vui lòng thử lại hoặc dùng đăng nhập email/mật khẩu',
    );
  }

  if (!cred) {
    throw new Error(
      kind === 'face'
        ? 'Chưa đăng ký khuôn mặt trên thiết bị này. Vui lòng đăng nhập bằng mật khẩu trước.'
        : 'Chưa đăng ký vân tay trên thiết bị này. Vui lòng đăng nhập bằng mật khẩu trước.',
    );
  }

  const fp = await deviceFingerprint.get();

  try {
    const res = await apiClient.post<ServerLoginResponse>(`/biometric/login-${kind}`, {
      credential_id: Number(cred.credentialId),
      bio_token: cred.bioToken,
      device_fingerprint: fp,
    });
    const user = await persistAuth(res.data);
    return { user, matchedBy: kind };
  } catch (err) {
    // 401: credential revoked/expired on the server. Wipe locally so the
    // user falls back to password and re-enrols cleanly.
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      await secureKeystore.deleteBioCredential(kind);
    }
    throw new Error(laravelErrorMessage(err, 'Sinh trắc không khớp với tài khoản trên thiết bị này'));
  }
}

export const biometricApi = {
  /**
   * Enrol a device-bound biometric credential.
   *
   * `kind` is now EXPLICIT: trang vân tay truyền 'fingerprint', trang khuôn mặt
   * truyền 'face'. Bỏ trống thì fallback về modality chính của máy. Đăng ký một
   * loại sẽ tự xóa ô loại còn lại (xem `enroll()`), nên hai loại không bao giờ
   * đè nhau. Đúng MỘT cửa sổ sinh trắc của OS bật (bên trong lúc lưu Keystore).
   */
  async enrollBiometric(
    opts: { kind?: 'face' | 'fingerprint'; label?: string } = {},
  ): Promise<{ credentialId: number; kind: 'face' | 'fingerprint' }> {
    const kind = opts.kind ?? (await biometricService.primaryKind());
    const res = await enroll(kind, opts.label ?? `bio:${kind}`);
    return { credentialId: res.credentialId, kind };
  },

  /**
   * Unified login — Task 2.
   *
   * Reads whichever device-bound credential exists on this device and fires a
   * single OS prompt to release the bio_token. One code path; the OS decides
   * whether the user shows a face or a finger. No more separate face-login /
   * finger-login screens.
   */
  async loginByBiometric(): Promise<{ user: User; matchedBy: 'face' | 'fingerprint' }> {
    const kind = await resolveEnrolledKind();
    if (!kind) {
      throw new Error(
        'Chưa đăng ký sinh trắc học trên thiết bị này. Vui lòng đăng nhập bằng mật khẩu, rồi bật sinh trắc trong phần Cài đặt.',
      );
    }
    return login(kind);
  },

  /** True if ANY biometric credential is enrolled on this device. */
  async hasAnyEnrolled(): Promise<boolean> {
    const [face, finger] = await Promise.all([
      secureStorage.isFaceEnrolled(),
      secureStorage.isFingerprintEnrolled(),
    ]);
    return face || finger;
  },

  /** Wipe all biometric data on logout / unenroll. */
  async clearAll(): Promise<void> {
    await secureKeystore.clearAll();
    await secureStorage.clearAllBioCredentials();
    await secureStorage.setFaceEnrolled(false);
    await secureStorage.setFingerprintEnrolled(false);
  },
};
