import { NativeModules, Platform } from 'react-native';

const { BiometricHardware } = NativeModules as any;

export interface EnrollmentResult {
  publicKey: string; // PEM or base64-encoded public key
}

/**
 * JS wrapper around native biometric hardware module.
 * Native side (Android/iOS) should implement methods: enroll, sign
 * - enroll(options) -> Promise<{ publicKey }>
 * - sign(challenge) -> Promise<{ signature }>
 */
const ensureAvailable = () => {
  if (!BiometricHardware) throw new Error('BiometricHardware native module not installed');
};

export async function enroll(options?: { algorithm?: string; requireStrongBox?: boolean }): Promise<EnrollmentResult> {
  ensureAvailable();
  // native implementation returns { publicKey }
  return BiometricHardware.enroll(options);
}

export async function sign(challenge: string): Promise<{ signature: string }> {
  ensureAvailable();
  return BiometricHardware.sign(challenge);
}

export async function canAuthenticate(): Promise<{ status: number; message: string }> {
  ensureAvailable();
  if (typeof BiometricHardware.canAuthenticate !== 'function') {
    throw new Error('canAuthenticate not implemented on native module');
  }
  return BiometricHardware.canAuthenticate();
}

export default {
  enroll,
  sign,
  canAuthenticate,
};
