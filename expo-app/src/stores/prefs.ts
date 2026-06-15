import { create } from 'zustand';
import { secureStorage } from '@/services/secureStorage';

interface PrefsState {
  privacyMode: boolean;
  biometricEnabled: boolean;
  setPrivacy: (v: boolean) => Promise<void>;
  setBiometric: (v: boolean) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const usePrefs = create<PrefsState>((set) => ({
  privacyMode: false,
  biometricEnabled: false,
  async setPrivacy(v) {
    await secureStorage.setPrivacyMode(v);
    set({ privacyMode: v });
  },
  async setBiometric(v) {
    await secureStorage.setBiometricEnabled(v);
    set({ biometricEnabled: v });
  },
  async hydrate() {
    set({
      privacyMode: await secureStorage.isPrivacyMode(),
      biometricEnabled: await secureStorage.isBiometricEnabled(),
    });
  },
}));
