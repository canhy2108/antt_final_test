import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { secureStorage } from '@/services/secureStorage';
import { userBiometricService } from '@/services/userBiometric';
import { biometricApi } from '@/api/biometric';
import { biometricService } from '@/services/biometric';
import { usePrefs } from '@/stores/prefs';
import { authApi } from '@/api/auth';
import { haptic } from '@/utils/haptics';
import { openOsBiometricSettings, osBiometricSettingsHint } from '@/utils/biometricSettings';
import { Alert } from 'react-native';

/**
 * Fingerprint enrolment — *simulated* press-and-hold. Mobile OSes don't
 * expose the actual fingerprint sensor to apps (only the OS-level prompt),
 * so a true app-level fingerprint capture is impossible. For the demo we
 * record the hold duration as a per-user "stamp" and animate the classic
 * fingerprint UI. Each BudgetBee account gets its own enrolment slot — the
 * thing the user explicitly asked for.
 */
type Phase = 'verify-password' | 'idle' | 'holding' | 'success' | 'too-short';

const HOLD_TARGET_MS = 3000;

export default function FingerprintScanScreen() {
  const [phase, setPhase] = useState<Phase>('verify-password');
  const setBio = usePrefs((s) => s.setBiometric);

  // Password verification
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Hold tracking
  const holdStartRef = useRef<number | null>(null);
  const [holdMs, setHoldMs] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse + ripple animations
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const userEmail = (await secureStorage.getUserEmail()) ?? '';
      setEmail(userEmail);
    })();
  }, []);

  useEffect(() => {
    if (phase !== 'holding') {
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

  async function verifyPassword() {
    if (!password.trim()) {
      setPwError('Vui lòng nhập mật khẩu');
      haptic.error();
      return;
    }
    if (!email) {
      setPwError('Không tìm thấy email — vui lòng đăng nhập lại');
      haptic.error();
      return;
    }
    setPwError(null);
    setVerifying(true);
    try {
      await authApi.login(email, password);
      // No local password caching — see userBiometric.ts.

      // OS gate: even if the password is right, the next step (saving the
      // bio_token into Keystore behind a biometric ACL) requires the
      // device to have at least one fingerprint enrolled in the OS. If
      // not, send the user to Settings instead of failing on the next
      // screen.
      const cap = await biometricService.getCapability();
      if (cap === 'unavailable') {
        Alert.alert(
          'Thiết bị chưa đăng ký vân tay',
          'Để dùng đăng nhập vân tay BudgetBee, bạn cần bật vân tay trong Cài đặt thiết bị trước.\n\n' +
            osBiometricSettingsHint(),
          [
            { text: 'Để sau', style: 'cancel' },
            {
              text: 'Mở Cài đặt',
              onPress: async () => {
                await openOsBiometricSettings();
              },
            },
          ],
        );
        return;
      }

      haptic.success();
      setPhase('idle');
    } catch (e: any) {
      setPwError(e?.message ?? 'Mật khẩu không đúng');
      haptic.error();
    } finally {
      setVerifying(false);
    }
  }

  function onPressIn() {
    if (phase !== 'idle' && phase !== 'too-short') return;
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
        // Auto-complete on target — no need to keep holding
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

    // The OS fingerprint prompt + the device-bound credential is what
    // actually matters; hold-time is just visual feedback. enrollFingerprint
    // gates on biometricService.authenticate() (OS prompt) before talking
    // to the server, so we can't enroll if the real owner isn't present.
    try {
      await biometricApi.enrollFingerprint(`finger:${email}`);
      haptic.success();
    } catch (e: any) {
      haptic.error();
      setPhase('too-short');
      setHoldMs(0);
      return;
    }
    await userBiometricService.enrollFingerprint(email, elapsed);
    await setBio(true);
    setPassword('');
    setPhase('success');
    setTimeout(() => router.back(), 1100);
  }

  const progress = Math.min(1, holdMs / HOLD_TARGET_MS);
  const ringStyle = {
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
  };

  // -------------------------------------------------------------- RENDER --

  if (phase === 'verify-password') {
    return (
      <SafeAreaView style={styles.bg} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={28} color={Colors.white} />
          </Pressable>
          <Text style={[Typography.headingM, { color: Colors.white }]}>Đăng ký vân tay</Text>
          <View style={{ width: 28 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.pwBody}>
            <View style={styles.pwIcon}>
              <Ionicons name="key" size={48} color={Colors.primary} />
            </View>
            <Text style={[Typography.displayM, { color: Colors.white, marginTop: 24, textAlign: 'center' }]}>
              Xác nhận mật khẩu
            </Text>
            <Text
              style={[
                Typography.bodyM,
                { color: 'rgba(255,255,255,0.7)', marginTop: 12, textAlign: 'center', paddingHorizontal: 16 },
              ]}
            >
              Vân tay sẽ được liên kết với tài khoản này. Nhập mật khẩu để xác nhận đúng chủ tài khoản.
            </Text>

            <View style={styles.emailChip}>
              <Ionicons name="mail" size={14} color={Colors.white} />
              <Text style={[Typography.labelM, { color: Colors.white, marginLeft: 6 }]} numberOfLines={1}>
                {email || '—'}
              </Text>
            </View>

            <View style={styles.pwField}>
              <Ionicons name="lock-closed-outline" size={20} color="rgba(255,255,255,0.6)" />
              <TextInput
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (pwError) setPwError(null);
                }}
                placeholder="Mật khẩu BudgetBee"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                style={styles.pwInput}
                onSubmitEditing={verifyPassword}
                returnKeyType="go"
              />
            </View>

            {pwError ? (
              <View style={styles.pwErrorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.expense} />
                <Text style={[Typography.caption, { color: Colors.expense, marginLeft: 6, flex: 1 }]}>{pwError}</Text>
              </View>
            ) : null}

            <PrimaryButton
              label="Xác nhận"
              onPress={verifyPassword}
              loading={verifying}
              style={{ marginTop: Space.s24, alignSelf: 'stretch' }}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const isSuccess = phase === 'success';
  const isHolding = phase === 'holding';

  return (
    <SafeAreaView style={styles.bg} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.white} />
        </Pressable>
        <Text style={[Typography.headingM, { color: Colors.white }]}>Quét vân tay</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.center}>
        <Text style={[Typography.headingL, { color: Colors.white, textAlign: 'center', marginBottom: 24 }]}>
          {isSuccess
            ? 'Đã lưu vân tay ✓'
            : isHolding
            ? `Giữ tiếp... ${Math.ceil((HOLD_TARGET_MS - holdMs) / 1000)}s`
            : phase === 'too-short'
            ? 'Cần giữ lâu hơn — thử lại'
            : 'Nhấn và giữ vùng vân tay 3 giây'}
        </Text>

        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={phase === 'success' || phase === 'holding'}
          style={styles.fingerHub}
        >
          {isHolding ? <Animated.View style={[styles.pulseRing, ringStyle]} /> : null}

          {/* Progress ring */}
          <View style={styles.progressRing}>
            <View style={[styles.progressFill, { height: `${progress * 100}%` }]} />
          </View>

          {/* Fingerprint icon container */}
          <View
            style={[
              styles.fingerCircle,
              isSuccess && { backgroundColor: 'rgba(34,197,94,0.18)', borderColor: Colors.income },
              phase === 'too-short' && { borderColor: Colors.expense },
            ]}
          >
            <Ionicons
              name={isSuccess ? 'checkmark' : 'finger-print'}
              size={88}
              color={isSuccess ? Colors.income : phase === 'too-short' ? Colors.expense : Colors.primary}
            />
          </View>
        </Pressable>

        <Text style={[Typography.bodyM, { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 28, paddingHorizontal: 24 }]}>
          {isSuccess
            ? `Vân tay được lưu cho tài khoản ${email}. Mỗi tài khoản có vân tay riêng — không dùng chung với người khác.`
            : 'BudgetBee tự đăng ký vân tay riêng (không dùng dữ liệu vân tay của thiết bị). Mỗi tài khoản có vân tay riêng biệt.'}
        </Text>
      </View>

      <View style={styles.footer}>
        <Ionicons name="shield-checkmark" size={12} color="rgba(255,255,255,0.4)" />
        <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.4)', marginLeft: 6 }]}>
          Vân tay BudgetBee — bảo vệ bởi Secure Enclave / Android Keystore
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
  // Password verification screen
  pwBody: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 32 },
  pwIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(189,232,62,0.10)',
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    maxWidth: '100%',
  },
  pwField: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
    height: 56,
    borderRadius: Radius.m,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'stretch',
  },
  pwInput: { flex: 1, marginLeft: 8, color: Colors.white, fontSize: 16 },
  pwErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    borderRadius: Radius.m,
    backgroundColor: 'rgba(239,68,68,0.18)',
    alignSelf: 'stretch',
  },
});
