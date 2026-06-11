import * as LocalAuthentication from 'expo-local-authentication';
import { BiometricCapability, BiometricResult } from '@/types';

export const biometricService = {
  async getCapability(): Promise<BiometricCapability> {
    try {
      const supported = await LocalAuthentication.hasHardwareAsync();
      if (!supported) return 'unavailable';

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (enrolled && types.length > 0) return 'biometric';

      const secured = await LocalAuthentication.getEnrolledLevelAsync();
      if (secured === LocalAuthentication.SecurityLevel.SECRET) return 'deviceCredential';

      return 'unavailable';
    } catch {
      return 'unavailable';
    }
  },

  async isAvailable() {
    const cap = await this.getCapability();
    return cap !== 'unavailable';
  },

  async authenticate(reason = 'Xác thực để vào BudgetBee'): Promise<BiometricResult> {
    try {
      const cap = await this.getCapability();
      if (cap === 'unavailable') return 'notAvailable';

      // IMPORTANT: disableDeviceFallback=true attempts to prevent the OS
      // from offering the device passcode as a fallback after biometric
      // failures. This reduces the chance that someone who only knows the
      // device password can bypass biometric-only protection.
      // Note: behaviour depends on platform/version — on some Android
      // devices the system may still require device credential for security.
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        disableDeviceFallback: true,
        cancelLabel: 'Huỷ',
        fallbackLabel: '',
      });

      if (res.success) return 'success';
      if (res.error === 'not_enrolled') return 'notEnrolled';
      if (res.error === 'lockout') return 'lockedOut';
      if (res.error === 'not_available' || res.error === 'passcode_not_set') return 'notAvailable';
      if (res.error === 'user_cancel' || res.error === 'system_cancel') return 'failed';
      return 'error';
    } catch {
      return 'error';
    }
  },
};
