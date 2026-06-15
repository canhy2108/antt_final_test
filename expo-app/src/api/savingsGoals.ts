import axios from 'axios';
import { apiClient } from './client';

export interface SavingsGoal {
  id: number;
  name: string;
  icon?: string | null;
  color?: string | null;
  target_amount: string;     // backend returns decimal as string
  current_amount: string;
  currency: string;
  started_at: string;
  target_date?: string | null;
  completed_at?: string | null;
  account_id?: number | null;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  milestones_reached?: number[];
  notes?: string | null;
  progress_percent: number;
  days_left: number | null;
}

export interface SavingsGoalListResponse {
  items: SavingsGoal[];
  active_count: number;
  total_target: number;
  total_saved: number;
}

export interface ContributeResponse {
  contribution: {
    id: number;
    amount: string;
    contributed_on: string;
    notes?: string | null;
  };
  crossed_milestone: number | null; // 25 | 50 | 75 | 100 | null
  goal: SavingsGoal;
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

export const savingsGoalsApi = {
  async list(): Promise<SavingsGoalListResponse> {
    try {
      const res = await apiClient.get<SavingsGoalListResponse>('/savings-goals');
      return {
        items: Array.isArray(res.data?.items) ? res.data.items : [],
        active_count: Number(res.data?.active_count ?? 0),
        total_target: Number(res.data?.total_target ?? 0),
        total_saved: Number(res.data?.total_saved ?? 0),
      };
    } catch {
      return { items: [], active_count: 0, total_target: 0, total_saved: 0 };
    }
  },

  async show(id: number): Promise<SavingsGoal & { contributions: any[] }> {
    const res = await apiClient.get(`/savings-goals/${id}`);
    return res.data;
  },

  async create(payload: {
    name: string;
    target_amount: number;
    started_at: string;
    target_date?: string;
    icon?: string;
    color?: string;
    notes?: string;
  }): Promise<SavingsGoal> {
    try {
      const res = await apiClient.post<SavingsGoal>('/savings-goals', payload);
      return res.data;
    } catch (e) {
      throw new Error(err(e, 'Không tạo được mục tiêu'));
    }
  },

  async update(id: number, payload: Partial<SavingsGoal>): Promise<SavingsGoal> {
    const res = await apiClient.post<SavingsGoal>(`/savings-goals/${id}`, payload);
    return res.data;
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/savings-goals/${id}`);
  },

  async contribute(
    id: number,
    payload: { amount: number; contributed_on: string; notes?: string },
  ): Promise<ContributeResponse> {
    try {
      const res = await apiClient.post<ContributeResponse>(`/savings-goals/${id}/contribute`, payload);
      return res.data;
    } catch (e) {
      throw new Error(err(e, 'Không thêm được tiền tiết kiệm'));
    }
  },
};
