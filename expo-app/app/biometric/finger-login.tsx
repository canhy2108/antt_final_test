import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { biometricApi } from '@/api/biometric';
import { useAuth } from '@/stores/auth';
import { haptic } from '@/utils/haptics';

/**
 * Fingerprint login — single-prompt UX.
 *
 * Same reasoning as face-login: previously we had a "press and hold for
 * 1.5s" fake animation BEFORE calling the real OS BiometricPrompt. Users
 * felt they had already given their fingerprint, then the OS prompt asked
 * them to do it again. Two scans for one login.
 *
 * Now we just fire the OS prompt on mount and let the OS own the entire
 * scan UX, exactly like Apple Wallet / Techcombank do.
 *
 * `startedRef` guards against React strict-mode / fast-refresh double effects
 * which would otherwise stack two OS prompts in quick succession.
 */
type Phase = 'authenticating' | 'success' | 'failed';

export default function FingerLoginScreen() {
  const setUser = useAuth((s) => s.setUser);

  const [phase, setPhase] = useState<Phase>('authenticating');
  const [matchedEmail, setMatchedEmail] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const startedRef = useRef(false);

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runOsBiometricLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'authenticating') {
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
      // Real biometric verification: OS Touch ID / Android Fingerprint
      // prompt fires inside this call. The device-bound bio_token is
      // released only after the OS confirms the real account owner.
      const { user } = await biometricApi.loginByFingerprint();
      setUser(user);
      setMatchedEmail(user.email);
      haptic.success();
      setPhase('success');
      setTimeout(() => router.replace('/(tabs)'), 600);
    } catch (e: any) {
      haptic.error();
      setErrorText(e?.message ?? 'Xác thực vân tay thất bại');
      setPhase('failed');
    }
  }

  function retry() {
    runOsBiometricLogin();
  }

  const isAuthenticating = phase === 'authenticating';
  const isSuccess = phase === 'success';
  const isFailed = phase === 'failed';

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <SafeAreaView style={styles.bg} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} disabled={isAuthenticating}>
          <Ionicons name="close" size={28} color={isAuthenticating ? 'rgba(255,255,255,0.3)' : Colors.white} />
        </Pressable>
        <Text style={[Typography.headingM, { color: Colors.white }]}>Đăng nhập vân tay</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.center}>
        <Text style={[Typography.headingL, { color: Colors.white, textAlign: 'center', marginBottom: 24 }]}>
          {isSuccess
            ? matchedEmail
              ? `Đăng nhập với ${matchedEmail}`
              : 'Đăng nhập thành công'
            : isFailed
            ? 'Xác thực vân tay thất bại'
            : 'Đang xác thực bằng vân tay'}
        </Text>

        <View style={styles.fingerHub}>
          {isAuthenticating ? (
            <Animated.View
              style={[styles.pulseRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
            />
          ) : null}

          <View
            style={[
              styles.fingerCircle,
              isSuccess && { backgroundColor: 'rgba(34,197,94,0.18)', borderColor: Colors.income },
              isFailed && { borderColor: Colors.expense, backgroundColor: 'rgba(239,68,68,0.10)' },
            ]}
          >
            <Ionicons
              name={isSuccess ? 'checkmark' : isFailed ? 'close' : 'finger-print'}
              size={88}
              color={isSuccess ? Colors.income : isFailed ? Colors.expense : Colors.primary}
            />
          </View>
        </View>

        {!isFailed ? (
          <Text style={[Typography.bodyS, { color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 18, paddingHorizontal: 24 }]}>
            Đặt ngón tay lên cảm biến vân tay của thiết bị
          </Text>
        ) : null}

        {errorText && isFailed ? (
          <Text style={[Typography.bodyS, { color: Colors.expense, textAlign: 'center', marginTop: 16, paddingHorizontal: 24 }]}>
            {errorText}
          </Text>
        ) : null}

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
  fingerHub: { width: HUB, height: HUB, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute',
    width: HUB,
    height: HUB,
    borderRadius: HUB / 2,
    backgroundColor: Colors.primary,
  },
  fingerCircle: {
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
