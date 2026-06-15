import { create } from 'zustand';
import { User } from '@/types';
import { authApi } from '@/api/auth';
import { secureStorage } from '@/services/secureStorage';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  /** Used by OTP verify + biometric flows that already have a User in hand. */
  setUser: (user: User) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  async login(email, password) {
    set({ loading: true, error: null });
    try {
      const user = await authApi.login(email, password);
      set({ user, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Đăng nhập thất bại' });
      throw e;
    }
  },
  async logout() {
    await authApi.logout();
    set({ user: null });
  },
  async hydrate() {
    const id = await secureStorage.getUserId();
    const email = await secureStorage.getUserEmail();
    const name = await secureStorage.getUserName();
    if (id && email && name) set({ user: { id, email, name } });
  },
  setUser(user) {
    set({ user });
  },
}));
