import axios from 'axios';
import { apiClient } from './client';

export interface RecurringTransaction {
  id: number;
  name: string;
  type: 'income' | 'expense';
  amount: string;
  from_account_id: number;
  category_id?: number | null;
  payment_method?: string | null;
  note?: string | null;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  starts_on: string;
  ends_on?: string | null;
  next_run_at?: string | null;
  last_run_at?: string | null;
  run_count: number;
  is_active: boolean;
  auto_create_record: boolean;
  notify_before: boolean;
}

function err(e: unknown, f: string): string {
  if (axios.isAxiosError(e) && e.response) {
    const d = e.response.data as any;
    if (d?.errors) {
      const first = Object.values(d.errors)[0];
      if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
    }
    if (typeof d?.message === 'string') return d.message;
  }
  return e instanceof Error ? e.message : f;
}

export const recurringApi = {
  async list(): Promise<{ items: RecurringTransaction[]; active_count: number; next_upcoming: RecurringTransaction | null }> {
    try {
      const res = await apiClient.get('/recurring');
      return {
        items: Array.isArray(res.data?.items) ? res.data.items : [],
        active_count: Number(res.data?.active_count ?? 0),
        next_upcoming: res.data?.next_upcoming ?? null,
      };
    } catch {
      return { items: [], active_count: 0, next_upcoming: null };
    }
  },

  async create(payload: {
    name: string;
    type: 'income' | 'expense';
    amount: number;
    from_account_id: number;
    category_id?: number;
    payment_method?: string;
    note?: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    starts_on: string;
    ends_on?: string;
  }): Promise<RecurringTransaction> {
    try {
      const res = await apiClient.post<RecurringTransaction>('/recurring', payload);
      return res.data;
    } catch (e) {
      throw new Error(err(e, 'Không tạo được giao dịch định kỳ'));
    }
  },

  async update(id: number, payload: Partial<RecurringTransaction>): Promise<RecurringTransaction> {
    const res = await apiClient.post<RecurringTransaction>(`/recurring/${id}`, payload);
    return res.data;
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/recurring/${id}`);
  },

  async runNow(id: number): Promise<{ record: any; recurring: RecurringTransaction }> {
    const res = await apiClient.post(`/recurring/${id}/run-now`);
    return res.data;
  },
};
