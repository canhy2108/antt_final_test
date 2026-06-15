import axios from 'axios';
import { apiClient } from './client';

export interface Device {
  id: number;
  name?: string | null;
  platform?: string | null;
  os_version?: string | null;
  app_version?: string | null;
  last_ip?: string | null;
  last_location?: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_trusted: boolean;
  revoked_at?: string | null;
}

export interface UserSession {
  id: number;
  device_id?: number | null;
  personal_access_token_id?: number | null;
  auth_method: 'password' | 'face' | 'fingerprint' | 'totp';
  ip_address?: string | null;
  user_agent?: string | null;
  started_at: string;
  last_active_at: string;
  expires_at?: string | null;
  revoked_at?: string | null;
}

function err(e: unknown, f: string): string {
  if (axios.isAxiosError(e) && e.response) {
    const d = e.response.data as any;
    if (typeof d?.message === 'string') return d.message;
  }
  return e instanceof Error ? e.message : f;
}

export const devicesApi = {
  async list(): Promise<{ devices: Device[]; active_sessions: UserSession[]; current_token_id: number | null }> {
    try {
      const res = await apiClient.get('/devices');
      return {
        devices: Array.isArray(res.data?.devices) ? res.data.devices : [],
        active_sessions: Array.isArray(res.data?.active_sessions) ? res.data.active_sessions : [],
        current_token_id: res.data?.current_token_id ?? null,
      };
    } catch {
      return { devices: [], active_sessions: [], current_token_id: null };
    }
  },

  async register(payload: {
    device_fingerprint: string;
    name?: string;
    platform?: 'ios' | 'android' | 'web';
    os_version?: string;
    app_version?: string;
  }): Promise<Device> {
    const res = await apiClient.post<Device>('/devices/register', payload);
    return res.data;
  },

  async trust(id: number): Promise<Device> {
    const res = await apiClient.post<Device>(`/devices/${id}/trust`);
    return res.data;
  },

  async revoke(id: number): Promise<void> {
    try {
      await apiClient.delete(`/devices/${id}`);
    } catch (e) {
      throw new Error(err(e, 'Không gỡ được thiết bị'));
    }
  },

  async revokeOthers(): Promise<void> {
    try {
      await apiClient.post('/devices/revoke-others');
    } catch (e) {
      throw new Error(err(e, 'Không đăng xuất các thiết bị khác được'));
    }
  },
};
