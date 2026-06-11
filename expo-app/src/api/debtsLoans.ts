import axios from 'axios';
import { apiClient } from './client';

export interface DebtLoan {
  id: number;
  direction: 'lent' | 'borrowed';
  counterparty_name: string;
  counterparty_phone?: string | null;
  principal_amount: string;
  remaining_amount: string;
  currency: string;
  interest_rate: string;
  interest_type?: string | null;
  started_at: string;
  due_at?: string | null;
  settled_at?: string | null;
  status: 'open' | 'partially_settled' | 'settled' | 'overdue' | 'written_off';
  notes?: string | null;
  is_overdue: boolean;
  days_until_due: number | null;
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

export const debtsLoansApi = {
  async list(): Promise<{ items: DebtLoan[]; totals: { lent_remaining: number; borrowed_remaining: number; overdue_count: number } }> {
    try {
      const res = await apiClient.get('/debts-loans');
      return {
        items: Array.isArray(res.data?.items) ? res.data.items : [],
        totals: res.data?.totals ?? { lent_remaining: 0, borrowed_remaining: 0, overdue_count: 0 },
      };
    } catch {
      return { items: [], totals: { lent_remaining: 0, borrowed_remaining: 0, overdue_count: 0 } };
    }
  },

  async create(payload: {
    direction: 'lent' | 'borrowed';
    counterparty_name: string;
    counterparty_phone?: string;
    principal_amount: number;
    started_at: string;
    due_at?: string;
    notes?: string;
  }): Promise<DebtLoan> {
    try {
      const res = await apiClient.post<DebtLoan>('/debts-loans', payload);
      return res.data;
    } catch (e) {
      throw new Error(err(e, 'Không tạo được khoản nợ/vay'));
    }
  },

  async settle(id: number, payload: { amount: number; settled_on: string; notes?: string }): Promise<{ debt: DebtLoan }> {
    try {
      const res = await apiClient.post(`/debts-loans/${id}/settle`, payload);
      return res.data;
    } catch (e) {
      throw new Error(err(e, 'Không ghi nhận được trả nợ'));
    }
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/debts-loans/${id}`);
  },
};
