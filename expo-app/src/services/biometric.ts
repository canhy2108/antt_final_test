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

  /**
   * True if the device physically has biometric hardware at all.
   * Task 2 gate: when this is false we HIDE the biometric feature entirely
   * (no point offering Face ID on a device with no sensor). When it's true
   * but nothing is enrolled, we instead show a "set it up in Settings" CTA.
   */
  async hasHardware(): Promise<boolean> {
    try {
      return await LocalAuthentication.hasHardwareAsync();
    } catch {
      return false;
    }
  },

  /**
   * Which biometric modality should the app present as THE device biometric?
   *
   * expo-local-authentication reports every supported type; we collapse that
   * into a single kind so the whole app speaks of "sinh trắc học" instead of
   * branching face-vs-fingerprint. The OS still owns the actual prompt — this
   * only decides which icon/label to show and which stored credential to try.
   *
   * Preference: facial recognition first (Face ID / Face Unlock), else
   * fingerprint. On a device with both, the OS prompt will still offer
   * whatever the user has; we just pick a sensible default label.
   */
  async primaryKind(): Promise<'face' | 'fingerprint'> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'face';
      }
      return 'fingerprint';
    } catch {
      return 'fingerprint';
    }
  },

  /** Vietnamese noun for the device's primary modality (for UI copy). */
  async primaryLabel(): Promise<string> {
    return (await this.primaryKind()) === 'face' ? 'khuôn mặt' : 'vân tay';
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
