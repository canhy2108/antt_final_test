import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { secureStorage } from '@/services/secureStorage';

/**
 * Bank-style auto-lock.
 *
 * Rules:
 *   - When the app goes to background or inactive, stamp the time.
 *   - When it comes back, if the gap exceeds the timeout and the user
 *     has a PIN set, route to /biometric-lock and force re-auth.
 *
 * Default timeout is 30 seconds — matches the spec for the security
 * checklist item "30 giây không hoạt động → khóa".
 */
const DEFAULT_LOCK_AFTER_MS = 30_000;

export function useAppLock(timeoutMs = DEFAULT_LOCK_AFTER_MS) {
  const lastBackgroundedAt = useRef<number | null>(null);
  const currentState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const prev = currentState.current;
      currentState.current = next;

      // Going to background — start the timer.
      if ((next === 'background' || next === 'inactive') && prev === 'active') {
        lastBackgroundedAt.current = Date.now();
        return;
      }

      // Returning to foreground — decide whether to lock.
      if (next === 'active' && (prev === 'background' || prev === 'inactive')) {
        const stampedAt = lastBackgroundedAt.current;
        lastBackgroundedAt.current = null;
        if (!stampedAt) return;

        const elapsed = Date.now() - stampedAt;
        if (elapsed < timeoutMs) return;

        const hasPin = !!(await secureStorage.getPinHash());
        const isLoggedIn = !!(await secureStorage.getAccessToken());
        if (!hasPin || !isLoggedIn) return;

        try {
          router.replace('/biometric-lock');
        } catch {
          // Router may not be ready yet on cold start — safe to ignore.
        }
      }
    });

    return () => sub.remove();
  }, [timeoutMs]);
}
