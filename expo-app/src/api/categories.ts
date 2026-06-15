import axios from 'axios';
import { apiClient } from './client';

export interface Category {
  id: number;
  name: string;
  icon?: string;
  color?: string;
  parent_category_id?: number;
  parent_name?: string;
}

let cache: Category[] | null = null;

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

export const categoriesApi = {
  invalidateCache() {
    cache = null;
  },

  async getAll(opts: { fresh?: boolean } = {}): Promise<Category[]> {
    if (!opts.fresh && cache) return cache;
    try {
      const res = await apiClient.get<Category[]>('/category');
      cache = Array.isArray(res.data) ? res.data : [];
      return cache;
    } catch (err) {
      if (cache) return cache; // serve stale on transient error
      throw new Error(laravelErr(err, 'Không tải được danh mục'));
    }
  },

  /**
   * Filter categories by parent name (e.g. "Income" vs "Expense").
   * Useful for the transaction form: hide income categories when typing
   * an expense and vice versa.
   */
  async getByParent(parentNamePattern: RegExp | string): Promise<Category[]> {
    const all = await this.getAll();
    const re =
      typeof parentNamePattern === 'string'
        ? new RegExp(parentNamePattern, 'i')
        : parentNamePattern;
    return all.filter((c) => re.test(c.parent_name ?? ''));
  },
};
