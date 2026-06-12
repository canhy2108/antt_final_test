import { apiClient } from './client';
import { User } from '@/types';
import { secureStorage } from '@/services/secureStorage';
import axios from 'axios';

// Backend response shapes (match Laravel AuthController)
interface LoginSuccess {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: { id: string | number; name: string; email: string };
}

interface RegisterResponse {
  message: string;
  email: string;
  expires_in_minutes: number;
  requires_verification: true;
  /** DEV ONLY — present when APP_ENV=local + OTP_DEV_RETURN_CODE=true */
  dev_otp_code?: string;
}

interface VerifyOtpSuccess extends LoginSuccess {}

interface ResendOtpResponse {
  message: string;
  dev_otp_code?: string;
}

interface LoginUnverifiedResponse {
  message: string;
  requires_verification: true;
  email: string;
  dev_otp_code?: string;
}

/** Normalize a Laravel validation error into a flat Vietnamese message. */
function laravelErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && err.response) {
    const data = err.response.data as any;
    if (data?.errors && typeof data.errors === 'object') {
      // 422 validation: { errors: { field: [msg1, msg2] } }
      const first = Object.values(data.errors)[0];
      if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
    }
    if (typeof data?.message === 'string') return data.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

async function persistAuth(payload: LoginSuccess): Promise<User> {
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

export const authApi = {
  /**
   * Login with email + password.
   * Returns the User on success.
   * Throws an Error with backend message on 401.
   * Throws a special "VERIFY" error tagged with `{ requiresVerification: true, email, devOtpCode }`
   * when backend responds 403 + requires_verification (user must complete OTP).
   */
  async login(email: string, password: string): Promise<User> {
    try {
      const res = await apiClient.post<LoginSuccess>('/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      return await persistAuth(res.data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        const data = err.response.data as LoginUnverifiedResponse;
        if (data?.requires_verification) {
          const e: any = new Error(data.message ?? 'Email chưa được xác thực');
          e.requiresVerification = true;
          e.email = data.email;
          e.devOtpCode = data.dev_otp_code;
          throw e;
        }
      }
      throw new Error(laravelErrorMessage(err, 'Đăng nhập thất bại'));
    }
  },

  /**
   * Public self-registration. Returns the OTP-pending payload.
   * On success, navigate to OTP screen and pass email along.
   * `dev_otp_code` is included only in local env for easy testing.
   */
  async register(payload: { name: string; email: string; password: string }): Promise<RegisterResponse> {
    try {
      const res = await apiClient.post<RegisterResponse>('/register', {
        name: payload.name.trim(),
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        confirm_password: payload.password,
      });
      return res.data;
    } catch (err) {
      throw new Error(laravelErrorMessage(err, 'Đăng ký thất bại'));
    }
  },

  /**
   * Verify the OTP code for a registered email. On success backend returns
   * an access token — we persist auth and the caller can navigate to (tabs).
   */
  async verifyOtp(email: string, code: string): Promise<User> {
    try {
      const res = await apiClient.post<VerifyOtpSuccess>('/verify-otp', {
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });
      return await persistAuth(res.data);
    } catch (err) {
      throw new Error(laravelErrorMessage(err, 'Mã xác thực không đúng'));
    }
  },

  async resendOtp(email: string): Promise<ResendOtpResponse> {
    try {
      const res = await apiClient.post<ResendOtpResponse>('/resend-otp', {
        email: email.trim().toLowerCase(),
      });
      return res.data;
    } catch (err) {
      throw new Error(laravelErrorMessage(err, 'Không gửi lại được mã'));
    }
  },

  /**
   * BƯỚC 1 — Quên mật khẩu. Gửi OTP đặt lại tới email (nếu tồn tại).
   * Backend LUÔN trả message chung để không lộ email có đăng ký hay không
   * (chống account enumeration). Mã đặt lại CHỈ đi qua email — endpoint này
   * KHÔNG BAO GIỜ trả mã trong response (F1), kể cả ở môi trường dev.
   */
  async forgotPassword(
    email: string,
  ): Promise<{ message: string; expires_in_minutes?: number }> {
    try {
      const res = await apiClient.post('/forgot-password', {
        email: email.trim().toLowerCase(),
      });
      return res.data;
    } catch (err) {
      throw new Error(laravelErrorMessage(err, 'Không gửi được mã đặt lại'));
    }
  },

  /**
   * BƯỚC 2 — Đặt lại mật khẩu bằng OTP. Thành công ⇒ backend đã HUỶ mọi
   * phiên cũ (Sanctum token + refresh token). Người dùng phải đăng nhập
   * lại bằng mật khẩu mới — KHÔNG tự cấp token ở bước này.
   */
  async resetPassword(payload: {
    email: string;
    code: string;
    password: string;
  }): Promise<{ message: string }> {
    try {
      const res = await apiClient.post('/reset-password', {
        email: payload.email.trim().toLowerCase(),
        code: payload.code.trim(),
        password: payload.password,
        confirm_password: payload.password,
      });
      return res.data;
    } catch (err) {
      throw new Error(laravelErrorMessage(err, 'Không đặt lại được mật khẩu'));
    }
  },

  /**
   * TẦNG 2 — BƯỚC 1: Quên mật khẩu qua MAGIC LINK. Backend gửi email chứa liên
   * kết mở thẳng app (budgetbee://reset-link?token=...) — người dùng KHÔNG phải
   * gõ mã 6 số tay. Vẫn LUÔN trả message chung (chống account enumeration);
   * token CHỈ đi qua email, KHÔNG bao giờ nằm trong response.
   */
  async requestResetLink(
    email: string,
  ): Promise<{ message: string; expires_in_minutes?: number }> {
    try {
      const res = await apiClient.post('/request-reset-link', {
        email: email.trim().toLowerCase(),
      });
      return res.data;
    } catch (err) {
      throw new Error(laravelErrorMessage(err, 'Không gửi được liên kết đặt lại'));
    }
  },

  /**
   * TẦNG 2 — BƯỚC 2: Đặt lại mật khẩu bằng TOKEN từ magic link. Token tới từ
   * deep link (?token=...); CHỈ giữ trong bộ nhớ rồi gửi thẳng lên server —
   * KHÔNG log, KHÔNG lưu vào secure storage. Thành công ⇒ backend đã HUỶ mọi
   * phiên cũ; người dùng phải đăng nhập lại (KHÔNG tự cấp token ở bước này).
   */
  async resetPasswordViaLink(payload: {
    token: string;
    password: string;
  }): Promise<{ message: string }> {
    try {
      const res = await apiClient.post('/reset-password-link', {
        token: payload.token,
        password: payload.password,
        confirm_password: payload.password,
      });
      return res.data;
    } catch (err) {
      throw new Error(laravelErrorMessage(err, 'Không đặt lại được mật khẩu'));
    }
  },

  /**
   * Auth-required: request an OTP for a sensitive action. Caller should then
   * include the code in the body of the sensitive endpoint.
   */
  async requestSensitiveOtp(): Promise<ResendOtpResponse> {
    try {
      const res = await apiClient.post<ResendOtpResponse>('/sensitive-otp');
      return res.data;
    } catch (err) {
      throw new Error(laravelErrorMessage(err, 'Không gửi được mã xác nhận'));
    }
  },

  /**
   * PIN change flow. The new PIN never goes to the server — the FE just
   * uses these endpoints as a gate (email-OTP) before overwriting the
   * locally stored PIN hash.
   */
  pinChange: {
    async requestOtp(): Promise<{
      message: string;
      expires_in_minutes: number;
      attempts_remaining: number;
      daily_limit_reached?: boolean;
      dev_otp_code?: string;
    }> {
      try {
        const res = await apiClient.post('/pin-change/request-otp');
        return res.data;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 429) {
          const data = err.response.data as any;
          const e: any = new Error(data?.message ?? 'Bạn đã yêu cầu đổi PIN quá nhiều lần hôm nay.');
          e.dailyLimitReached = true;
          throw e;
        }
        throw new Error(laravelErrorMessage(err, 'Không gửi được mã OTP'));
      }
    },

    async verifyOtp(code: string): Promise<void> {
      try {
        await apiClient.post('/pin-change/verify', { code: code.trim() });
      } catch (err) {
        throw new Error(laravelErrorMessage(err, 'Mã OTP không đúng'));
      }
    },
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/user/logout');
    } catch {
      // Even if server logout fails (offline, expired token), clear local state.
    }
    await secureStorage.clearSession();
  },
};
