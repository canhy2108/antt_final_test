import axios from 'axios';
import { apiClient } from './client';
import { Account } from '@/types';

export interface AccountType {
  id: number;
  name: string;
}

export interface UserCurrencyShape {
  id: number;
  currency_id: number;
  code: string;
  symbol: string;
  name: string;
  exchange_rate_to_default_currency?: number;
}

interface BackendAccount {
  id: number;
  name: string;
  type_id: number;
  type_name?: string;
  color: string;
  initial_balance?: number | string;
  current_balance?: number | string;
  balance?: number | string;
  currency_id: number;
  currency_symbol?: string;
  position?: number;
}

let typesCache: AccountType[] | null = null;
let currenciesCache: UserCurrencyShape[] | null = null;

function toNumber(v: any, def = 0): number {
  if (v === null || v === undefined) return def;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : def;
}

function mapAccount(raw: BackendAccount): Account {
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    type: raw.type_name ?? 'Tài khoản',
    balance: toNumber(raw.balance ?? raw.current_balance ?? raw.initial_balance),
    currencySymbol: raw.currency_symbol ?? '₫',
    color: raw.color ?? '#BDE83E',
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

export const accountsApi = {
  /** Drop cached lookup tables — call on logout. */
  invalidateCache() {
    typesCache = null;
    currenciesCache = null;
  },

  async getTypes(): Promise<AccountType[]> {
    if (typesCache) return typesCache;
    try {
      const res = await apiClient.get<AccountType[]>('/account/type');
      typesCache = Array.isArray(res.data) ? res.data : [];
      return typesCache;
    } catch {
      return [];
    }
  },

  async getCurrencies(): Promise<UserCurrencyShape[]> {
    if (currenciesCache) return currenciesCache;
    try {
      const res = await apiClient.get<UserCurrencyShape[]>('/account/currencies');
      currenciesCache = Array.isArray(res.data) ? res.data : [];
      return currenciesCache;
    } catch {
      return [];
    }
  },

  async getAll(): Promise<Account[]> {
    try {
      const res = await apiClient.get<BackendAccount[]>('/account');
      return Array.isArray(res.data) ? res.data.map(mapAccount) : [];
    } catch (err) {
      throw new Error(laravelErr(err, 'Không tải được danh sách tài khoản'));
    }
  },

  async create(payload: {
    name: string;
    type_id: number;
    color: string;
    initial_balance: number;
    currency_id: number;
  }): Promise<Account> {
    try {
      const res = await apiClient.post<BackendAccount>('/account', payload);
      return mapAccount(res.data);
    } catch (err) {
      throw new Error(laravelErr(err, 'Không tạo được tài khoản'));
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await apiClient.delete(`/account/${id}`);
    } catch (err) {
      throw new Error(laravelErr(err, 'Không xoá được tài khoản'));
    }
  },
};
