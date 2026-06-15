import axios from 'axios';
import { apiClient } from './client';
import { Transaction, MonthStats, TransactionType } from '@/types';

interface BackendRecord {
  id: number;
  date: string;
  name?: string;
  note?: string;
  type: TransactionType;
  amount: number | string;
  category_id?: number;
  category_name?: string;
  category_color?: string;
  from_account_id?: number;
  to_account_id?: number;
}

function toNumber(v: any, def = 0): number {
  if (v === null || v === undefined) return def;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : def;
}

function mapRecord(raw: BackendRecord): Transaction {
  return {
    id: String(raw.id),
    type: raw.type ?? 'expense',
    amount: Math.abs(toNumber(raw.amount)),
    date: raw.date ?? new Date().toISOString().slice(0, 10),
    name: raw.name ?? '',
    note: raw.note,
    categoryId: String(raw.category_id ?? ''),
    categoryName: raw.category_name ?? 'Khác',
    categoryColor: raw.category_color ?? '#A1A1AA',
    accountId: String(raw.from_account_id ?? ''),
  };
}

function laravelErr(err: unknown, fallback: string): string {
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

export const transactionsApi = {
  async getRecent(limit = 10): Promise<Transaction[]> {
    try {
      const res = await apiClient.get<BackendRecord[]>('/record/last', { params: { limit } });
      return Array.isArray(res.data) ? res.data.slice(0, limit).map(mapRecord) : [];
    } catch (err) {
      throw new Error(laravelErr(err, 'Lỗi tải giao dịch gần đây'));
    }
  },

  async getAll(
    opts: { page?: number; type?: string | null; search?: string | null; from?: string; to?: string } = {},
  ): Promise<Transaction[]> {
    try {
      const params: Record<string, any> = {};
      if (opts.page) params.page = opts.page;
      if (opts.type) params.type = opts.type;
      if (opts.search) params.search_term = opts.search;
      if (opts.from) params.from_date = opts.from;
      if (opts.to) params.to_date = opts.to;
      const res = await apiClient.get<BackendRecord[]>('/record', { params });
      return Array.isArray(res.data) ? res.data.map(mapRecord) : [];
    } catch (err) {
      throw new Error(laravelErr(err, 'Lỗi tải danh sách giao dịch'));
    }
  },

  async getMonthStats(from?: string, to?: string): Promise<MonthStats> {
    try {
      const params: Record<string, string> = {};
      if (from) params.from_date = from;
      if (to) params.to_date = to;
      const res = await apiClient.get('/balance/all', { params });
      const d: any = res.data ?? {};
      return {
        income: toNumber(d.income ?? d.total_income ?? d.incomes),
        expense: toNumber(d.expense ?? d.total_expense ?? d.expenses),
        balance: toNumber(d.balance ?? d.total_balance ?? d.total),
      };
    } catch {
      return { income: 0, expense: 0, balance: 0 };
    }
  },

  /**
   * Create a transaction (a "Record" on backend).
   *
   * `category_id` is optional from the FE because the backend
   * `RecordController::create` defaults missing values to category 1
   * ("Other"). The auto-import flow relies on this when the parser
   * can't confidently pick a category from the notification text.
   */
  async create(payload: {
    type: TransactionType;
    amount: number;
    date: string;
    name?: string;
    note?: string;
    category_id?: number;
    from_account_id: number;
    to_account_id?: number;
  }): Promise<Transaction> {
    try {
      const res = await apiClient.post<BackendRecord>('/record', payload);
      return mapRecord(res.data);
    } catch (err) {
      throw new Error(laravelErr(err, 'Không tạo được giao dịch'));
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await apiClient.delete(`/record/${id}`);
    } catch (err) {
      throw new Error(laravelErr(err, 'Không xoá được giao dịch'));
    }
  },
};
