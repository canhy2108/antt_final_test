import axios from 'axios';
import { apiClient } from './client';

export interface TotpStatus {
  enabled: boolean;
  enrolled: boolean;
  backup_codes_remaining: number;
  last_verified_at?: string | null;
}

export interface TotpSetupResponse {
  secret: string;
  otpauth_url: string;
  qr_code_url: string;
  message: string;
}

export interface TotpVerifyResponse {
  enabled: boolean;
  backup_codes?: string[] | null;
  message: string;
}

function err(e: unknown, f: string): string {
  if (axios.isAxiosError(e) && e.response) {
    const d = e.response.data as any;
    if (typeof d?.message === 'string') return d.message;
  }
  return e instanceof Error ? e.message : f;
}

export const totpApi = {
  async status(): Promise<TotpStatus> {
    try {
      const res = await apiClient.get<TotpStatus>('/totp/status');
      return res.data;
    } catch {
      return { enabled: false, enrolled: false, backup_codes_remaining: 0 };
    }
  },

  async setup(): Promise<TotpSetupResponse> {
    try {
      const res = await apiClient.post<TotpSetupResponse>('/totp/setup');
      return res.data;
    } catch (e) {
      throw new Error(err(e, 'Không khởi tạo được TOTP'));
    }
  },

  async verify(code: string): Promise<TotpVerifyResponse> {
    try {
      const res = await apiClient.post<TotpVerifyResponse>('/totp/verify', { code });
      return res.data;
    } catch (e) {
      throw new Error(err(e, 'Mã không đúng hoặc đã hết hạn'));
    }
  },

  async disable(code: string): Promise<void> {
    try {
      await apiClient.post('/totp/disable', { code });
    } catch (e) {
      throw new Error(err(e, 'Không tắt được 2FA'));
    }
  },
};
