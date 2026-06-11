import axios from 'axios';
import { apiClient } from './client';

export type NotificationType =
  | 'welcome'
  | 'budget_exceeded'
  | 'low_balance'
  | 'large_transaction'
  | 'security_alert'
  | 'bio_enrolled'
  | 'system';

export interface BeNotification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ListResponse {
  items: BeNotification[];
  unread_count: number;
}

function laravelErr(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && err.response) {
    const data = err.response.data as any;
    if (typeof data?.message === 'string') return data.message;
  }
  return err instanceof Error ? err.message : fallback;
}

export const notificationsApi = {
  async list(opts: { limit?: number; unreadOnly?: boolean } = {}): Promise<ListResponse> {
    try {
      const params: Record<string, any> = {};
      if (opts.limit) params.limit = opts.limit;
      if (opts.unreadOnly) params.unread_only = true;
      const res = await apiClient.get<ListResponse>('/notification', { params });
      return {
        items: Array.isArray(res.data?.items) ? res.data.items : [],
        unread_count: Number(res.data?.unread_count ?? 0),
      };
    } catch {
      return { items: [], unread_count: 0 };
    }
  },

  async unreadCount(): Promise<number> {
    try {
      const res = await apiClient.get<{ unread_count: number }>('/notification/unread-count');
      return Number(res.data?.unread_count ?? 0);
    } catch {
      return 0;
    }
  },

  async markRead(id: number): Promise<void> {
    try {
      await apiClient.post(`/notification/${id}/read`);
    } catch (err) {
      throw new Error(laravelErr(err, 'Không đánh dấu được'));
    }
  },

  async markAllRead(): Promise<void> {
    try {
      await apiClient.post('/notification/read-all');
    } catch (err) {
      throw new Error(laravelErr(err, 'Không đánh dấu được'));
    }
  },

  async delete(id: number): Promise<void> {
    try {
      await apiClient.delete(`/notification/${id}`);
    } catch (err) {
      throw new Error(laravelErr(err, 'Không xoá được'));
    }
  },
};
