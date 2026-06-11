import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { biometricApi } from '@/api/biometric';
import { biometricService } from '@/services/biometric';
import { useAuth } from '@/stores/auth';
import { haptic } from '@/utils/haptics';
import { openOsBiometricSettings, osBiometricSettingsHint } from '@/utils/biometricSettings';

/**
 * Face login — single-prompt UX.
 *
 * Why no fake "scan animation" anymore:
 *   The previous version showed a camera preview with a sweep line + 1.8s
 *   progress bar BEFORE calling the OS. Users felt they had already scanned
 *   their face — then the OS biometric prompt popped up and asked them to
 *   scan AGAIN. Two perceived scans = one of the most common UX bugs in
 *   biometric apps.
 *
 *   Apple Wallet / Techcombank / VietQR do not do this: opening the screen
 *   *is* the trigger, the OS prompt is the only UI, and there is no in-app
 *   animation pretending to be a scan. We follow that pattern here.
 *
 * Lifecycle guard:
 *   `startedRef` makes sure the OS prompt is fired exactly once per mount.
 *   StrictMode / Fast Refresh in dev can call effects twice, and without
 *   the guard the OS would queue a second prompt right after the first.
 */
type Phase = 'checking' | 'os-not-enrolled' | 'authenticating' | 'success' | 'failed';

export default function FaceLoginScreen() {
  const setUser = useAuth((s) => s.setUser);

  const [phase, setPhase] = useState<Phase>('checking');
  const [matchedEmail, setMatchedEmail] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const startedRef = useRef(false);

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    // Pre-flight: confirm the OS has biometric enrolled BEFORE firing the
    // prompt. Otherwise the OS just returns "not_enrolled" instantly and
    // the user sees a useless error message — better to send them to
    // Settings up front.
    (async () => {
      const cap = await biometricService.getCapability();
      if (cap === 'unavailable') {
        setPhase('os-not-enrolled');
        return;
      }
      runOsBiometricLogin();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'authenticating' && phase !== 'checking') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, phase]);

  async function runOsBiometricLogin() {
    setErrorText(null);
    setPhase('authenticating');
    try {
      // The OS Face ID / Face Unlock prompt fires here. The device-bound
      // bio_token is only released by SecureStore after the OS confirms
      // the real account owner is present.
      const { user } = await biometricApi.loginByFace();
      setUser(user);
      setMatchedEmail(user.email);
      haptic.success();
      setPhase('success');
      setTimeout(() => router.replace('/(tabs)'), 600);
    } catch (e: any) {
      haptic.error();
      setErrorText(e?.message ?? 'Không xác thực được khuôn mặt');
      setPhase('failed');
    }
  }

  function retry() {
    runOsBiometricLogin();
  }

  async function recheckOsCapability() {
    const cap = await biometricService.getCapability();
    if (cap === 'unavailable') {
      setPhase('os-not-enrolled');
      return;
    }
    runOsBiometricLogin();
  }

  // OS-not-enrolled screen — show CTA to open Settings, then re-check.
  if (phase === 'os-not-enrolled') {
    return (
      <SafeAreaView style={styles.bg} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={28} color={Colors.white} />
          </Pressable>
          <Text style={[Typography.headingM, { color: Colors.white }]}>Đăng nhập khuôn mặt</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.center}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: '#F59E0B' },
            ]}
          >
            <Ionicons name="warning" size={64} color="#F59E0B" />
          </View>
          <Text style={[Typography.headingL, { color: Colors.white, textAlign: 'center', marginTop: 32 }]}>
            Thiết bị chưa bật Face ID
          </Text>
          <Text
            style={[
              Typography.bodyM,
              { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 8, paddingHorizontal: 24 },
            ]}
          >
            Hệ điều hành chưa đăng ký khuôn mặt nào, BudgetBee không thể quét. Hãy bật trong Cài đặt thiết bị trước.
            {'\n\n'}
            {osBiometricSettingsHint()}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: Space.s24, paddingHorizontal: 24 }}>
            <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
              <Text style={[Typography.buttonM, { color: Colors.white }]}>Dùng mật khẩu</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Mở Cài đặt"
                onPress={async () => {
                  const opened = await openOsBiometricSettings();
                  if (!opened) {
                    setErrorText('Không mở được Cài đặt. Vui lòng vào Cài đặt thủ công.');
                  }
                }}
              />
            </View>
          </View>
          <Pressable onPress={recheckOsCapability} style={{ marginTop: 16 }}>
            <Text style={[Typography.buttonM, { color: Colors.primary }]}>
              Tôi đã bật xong — Kiểm tra lại
            </Text>
          </Pressable>
          {errorText ? (
            <Text style={[Typography.bodyS, { color: Colors.expense, textAlign: 'center', marginTop: 12 }]}>
              {errorText}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const isChecking = phase === 'checking';
  const isAuthenticating = phase === 'authenticating';
  const isSuccess = phase === 'success';
  const isFailed = phase === 'failed';

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  const title = isSuccess
    ? matchedEmail
      ? `Đăng nhập với ${matchedEmail}`
      : 'Đăng nhập thành công'
    : isFailed
    ? 'Không xác thực được'
    : isChecking
    ? 'Đang kiểm tra thiết bị'
    : 'Đang xác thực bằng Face ID';

  const hint = isSuccess
    ? 'Đã xác thực bằng Face ID của thiết bị'
    : isFailed
    ? errorText ?? 'Vui lòng thử lại hoặc đăng nhập bằng mật khẩu'
    : isChecking
    ? 'Kiểm tra sinh trắc OS đã được bật chưa…'
    : 'Nhìn vào camera trước của thiết bị';

  return (
    <SafeAreaView style={styles.bg} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} disabled={isAuthenticating || isChecking}>
          <Ionicons name="close" size={28} color={isAuthenticating || isChecking ? 'rgba(255,255,255,0.3)' : Colors.white} />
        </Pressable>
        <Text style={[Typography.headingM, { color: Colors.white }]}>Đăng nhập khuôn mặt</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.center}>
        <View style={styles.iconHub}>
          {isAuthenticating || isChecking ? (
            <Animated.View
              style={[styles.pulseRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
            />
          ) : null}
          <View
            style={[
              styles.iconCircle,
              isSuccess && { backgroundColor: 'rgba(34,197,94,0.18)', borderColor: Colors.income },
              isFailed && { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: Colors.expense },
            ]}
          >
            <Ionicons
              name={isSuccess ? 'checkmark' : isFailed ? 'close' : 'scan'}
              size={72}
              color={isSuccess ? Colors.income : isFailed ? Colors.expense : Colors.primary}
            />
          </View>
        </View>

        <Text style={[Typography.headingL, { color: Colors.white, textAlign: 'center', marginTop: 32 }]}>
          {title}
        </Text>
        <Text
          style={[
            Typography.bodyM,
            { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 8, paddingHorizontal: 24 },
          ]}
        >
          {hint}
        </Text>

        {isFailed ? (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: Space.s24, paddingHorizontal: 24 }}>
            <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
              <Text style={[Typography.buttonM, { color: Colors.white }]}>Dùng mật khẩu</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Thử lại" onPress={retry} />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Ionicons name="shield-checkmark" size={12} color="rgba(255,255,255,0.4)" />
        <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.4)', marginLeft: 6 }]}>
          Xác thực bởi Secure Enclave / Android Keystore + token gắn thiết bị
        </Text>
      </View>
    </SafeAreaView>
  );
}

const HUB = 180;
const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0B0B0F' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.pageHorizontal,
    paddingVertical: 12,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  iconHub: { width: HUB, height: HUB, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute',
    width: HUB,
    height: HUB,
    borderRadius: HUB / 2,
    backgroundColor: Colors.primary,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(189,232,62,0.10)',
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space.s24,
  },
});
