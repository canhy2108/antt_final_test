import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useAuth } from '@/stores/auth';
import { usePrefs } from '@/stores/prefs';
import { userBiometricService } from '@/services/userBiometric';
import { useAppLock } from '@/hooks/useAppLock';
import { getMode as getBankImportMode, startListening as startBankListening } from '@/services/bankAutoImport';

export default function RootLayout() {
  const hydrateAuth = useAuth((s) => s.hydrate);
  const hydratePrefs = usePrefs((s) => s.hydrate);

  // 30s background → lock (PIN/biometric required to come back).
  // Matches the bank-style spec for app idle lock.
  useAppLock();

  useEffect(() => {
    hydrateAuth();
    hydratePrefs();
    // Scrub any leftover plaintext password slots from older installs.
    // Fire-and-forget; the implementation is gated by a one-time flag.
    userBiometricService.scrubLegacyData().catch(() => undefined);

    // Anti-screenshot / anti-screen-recording. On Android this maps to
    // WindowManager.FLAG_SECURE; on iOS it blanks the screen during
    // active recording. Only enable on native — web has no equivalent.
    if (Platform.OS !== 'web') {
      ScreenCapture.preventScreenCaptureAsync().catch(() => undefined);
    }

    // Bank notification auto-import — Android only. If the user previously
    // enabled it (mode != 'off'), wire the listener back on app start.
    // notificationListener.isAvailable() guards against Expo Go / iOS.
    if (Platform.OS === 'android') {
      (async () => {
        const mode = await getBankImportMode();
        if (mode !== 'off') startBankListening();
      })().catch(() => undefined);
    }
    return () => {
      if (Platform.OS !== 'web') {
        ScreenCapture.allowScreenCaptureAsync().catch(() => undefined);
      }
    };
  }, [hydrateAuth, hydratePrefs]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F2F2F4' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="transaction/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="transaction/list" />
          <Stack.Screen name="account/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="account/connect-bank" options={{ presentation: 'modal' }} />
          <Stack.Screen name="budget/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="biometric/setup" />
          <Stack.Screen name="biometric/login" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pin-change" options={{ presentation: 'modal' }} />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="savings/index" />
          <Stack.Screen name="savings/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="savings/[id]" />
          <Stack.Screen name="debts" />
          <Stack.Screen name="recurring/index" />
          <Stack.Screen name="recurring/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="devices" />
          <Stack.Screen name="totp-setup" options={{ presentation: 'modal' }} />
          <Stack.Screen name="biometric-lock" />
          <Stack.Screen name="ekyc" options={{ presentation: 'modal' }} />
          <Stack.Screen name="bank-notifications" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
