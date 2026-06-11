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
 * Fingerprint login screen.
 *
 * SECURITY: The real fingerprint check is the OS Touch ID / Android Fingerprint
 * prompt fired inside `biometricApi.loginByFingerprint`. The press-and-hold UI
 * is just visual feedback so the screen looks like a banking app; the actual
 * match happens in the Secure Enclave / TEE, and the device-bound credential
 * is released only after the OS confirms the real account owner.
 *
 * The old "match by closest hold-time within ±1500ms tolerance" logic let
 * anyone hold for ~3s and log in as whichever user enrolled closest to that
 * duration — that has been removed.
 */
type Phase = 'idle' | 'holding' | 'uploading' | 'success' | 'too-short' | 'failed';

const HOLD_TARGET_MS = 1500;

export default function FingerLoginScreen() {
  const setUser = useAuth((s) => s.setUser);

  const [phase, setPhase] = useState<Phase>('idle');
  const [matchedEmail, setMatchedEmail] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const holdStartRef = useRef<number | null>(null);
  const [holdMs, setHoldMs] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'holding' && phase !== 'uploading') {
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

  function onPressIn() {
    if (phase !== 'idle' && phase !== 'too-short' && phase !== 'failed') return;
    setErrorText(null);
    haptic.medium();
    holdStartRef.current = Date.now();
    setHoldMs(0);
    setPhase('holding');
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      if (holdStartRef.current === null) return;
      const elapsed = Date.now() - holdStartRef.current;
      setHoldMs(elapsed);
      if (elapsed >= HOLD_TARGET_MS) {
        finishHold(elapsed);
      }
    }, 50);
  }

  function onPressOut() {
    if (phase !== 'holding') return;
    if (holdStartRef.current === null) return;
    const elapsed = Date.now() - holdStartRef.current;
    finishHold(elapsed);
  }

  async function finishHold(elapsed: number) {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    holdStartRef.current = null;

    if (elapsed < HOLD_TARGET_MS) {
      haptic.warning();
      setPhase('too-short');
      setHoldMs(0);
      return;
    }

    setPhase('uploading');

    try {
      // Real biometric verification happens INSIDE this call:
      //   - OS Touch ID / Android Fingerprint prompt fires
      //   - Stored device-bound bio_token released only on OS pass
      //   - Server verifies hash, returns user + Sanctum token
      const { user } = await biometricApi.loginByFingerprint();
      setUser(user);
      setMatchedEmail(user.email);
      haptic.success();
      setPhase('success');
      setTimeout(() => router.replace('/(tabs)'), 800);
    } catch (e: any) {
      haptic.error();
      setErrorText(e?.message ?? 'Xác thực vân tay thất bại');
      setPhase('failed');
    }
  }

  function retry() {
    setErrorText(null);
    setMatchedEmail(null);
    setHoldMs(0);
    setPhase('idle');
  }

  const progress = Math.min(1, holdMs / HOLD_TARGET_MS);
  const ringStyle = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
  };

  const isSuccess = phase === 'success';
  const isHolding = phase === 'holding';
  const isUploading = phase === 'uploading';
  const isFailed = phase === 'failed';

  return (
    <SafeAreaView style={styles.bg} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.white} />
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
            : isUploading
            ? 'Đang xác thực với OS...'
            : isHolding
            ? `Giữ tiếp... ${Math.max(0, Math.ceil((HOLD_TARGET_MS - holdMs) / 1000))}s`
            : phase === 'too-short'
            ? 'Cần giữ lâu hơn — thử lại'
            : isFailed
            ? 'Xác thực vân tay thất bại'
            : 'Nhấn và giữ vùng vân tay'}
        </Text>

        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={isSuccess || isUploading || isHolding}
          style={styles.fingerHub}
        >
          {isHolding || isUploading ? <Animated.View style={[styles.pulseRing, ringStyle]} /> : null}

          <View style={styles.progressRing}>
            <View style={[styles.progressFill, { height: `${progress * 100}%` }]} />
          </View>

          <View
            style={[
              styles.fingerCircle,
              isSuccess && { backgroundColor: 'rgba(34,197,94,0.18)', borderColor: Colors.income },
              isFailed && { borderColor: Colors.expense, backgroundColor: 'rgba(239,68,68,0.10)' },
              phase === 'too-short' && { borderColor: Colors.expense },
            ]}
          >
            <Ionicons
              name={isSuccess ? 'checkmark' : isFailed ? 'close' : 'finger-print'}
              size={88}
              color={isSuccess ? Colors.income : isFailed || phase === 'too-short' ? Colors.expense : Colors.primary}
            />
          </View>
        </Pressable>

        {errorText ? (
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
  progressRing: {
    position: 'absolute',
    width: HUB,
    height: HUB,
    borderRadius: HUB / 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(189,232,62,0.06)',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(189,232,62,0.35)',
  },
  fingerCircle: {
    width: HUB,
    height: HUB,
    borderRadius: HUB / 2,
    backgroundColor: 'rgba(189,232,62,0.10)',
    borderWidth: 3,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space.s24,
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
});
