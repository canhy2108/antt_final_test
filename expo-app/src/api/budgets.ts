import axios from 'axios';
import { apiClient } from './client';
import { Budget } from '@/types';

interface BackendBudget {
  id: number;
  user_id: number;
  category_id: number;
  amount: number | string;
  // appended fields
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  parent_category_id?: number;
  parent_category_name?: string;
  spent?: number | string;
  spent_percent?: number | string;
}

function toNumber(v: any, def = 0): number {
  if (v === null || v === undefined) return def;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : def;
}

function mapBudget(raw: BackendBudget): Budget {
  return {
    id: String(raw.id),
    name: raw.category_name ?? 'Ngân sách',
    icon: raw.category_icon ?? 'wallet',
    color: raw.category_color ?? '#BDE83E',
    spent: toNumber(raw.spent),
    limit: toNumber(raw.amount),
    period: 'month', // backend doesn't store period; default monthly
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
  return err instanceof Error ? err.message : fallback;
}

export const budgetsApi = {
  async getAll(): Promise<Budget[]> {
    try {
      const res = await apiClient.get<BackendBudget[]>('/budget');
      return Array.isArray(res.data) ? res.data.map(mapBudget) : [];
    } catch {
      return [];
    }
  },

  async create(payload: { category_id: number; amount: number }): Promise<Budget> {
    try {
      const res = await apiClient.post<BackendBudget>('/budget', payload);
      return mapBudget(res.data);
    } catch (err) {
      throw new Error(laravelErr(err, 'Không tạo được ngân sách'));
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await apiClient.delete(`/budget/${id}`);
    } catch (err) {
      throw new Error(laravelErr(err, 'Không xoá được ngân sách'));
    }
  },
};
