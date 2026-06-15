import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/stores/auth';
import { biometricService } from '@/services/biometric';
import { biometricApi } from '@/api/biometric';
import { haptic } from '@/utils/haptics';

/**
 * Login screen.
 *
 * Nút vân tay nhỏ cạnh nút "Đăng nhập" gọi THẲNG cửa sổ vân tay/sinh trắc của
 * hệ điều hành (không qua màn trung gian). Ẩn khi máy không có cảm biến.
 */
export default function LoginScreen() {
  const login = useAuth((s) => s.login);
  const setUser = useAuth((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whether to show the biometric shortcut + which icon/label to use. We gate
  // on hardware presence (Task 2): no sensor → no button at all.
  const [bioHardware, setBioHardware] = useState(false);
  const [bioKind, setBioKind] = useState<'face' | 'fingerprint'>('fingerprint');

  useEffect(() => {
    (async () => {
      const hw = await biometricService.hasHardware();
      setBioHardware(hw);
      if (hw) setBioKind(await biometricService.primaryKind());
    })();
  }, []);

  async function onSubmit() {
    if (!email.trim() || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu');
      haptic.error();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      haptic.success();
      // We intentionally do NOT cache the password locally — see
      // userBiometric.ts notes on the previous "biometric fast login"
      // anti-pattern. Re-enrolment asks for the password explicitly.
      router.replace('/(tabs)');
    } catch (e: any) {
      if (e?.requiresVerification) {
        haptic.warning();
        router.push({
          pathname: '/(auth)/otp',
          params: { email: e.email ?? email.trim(), devOtp: e.devOtpCode ?? '' },
        });
        return;
      }
      setError(e?.message ?? 'Đăng nhập thất bại');
      haptic.error();
    } finally {
      setLoading(false);
    }
  }

  async function onBiometricLogin() {
    if (bioLoading) return;
    haptic.light();
    setError(null);
    setBioLoading(true);
    try {
      // Gọi thẳng cửa sổ vân tay/sinh trắc của hệ điều hành. SecureStore mở
      // bio_token sau khi vân tay khớp → đăng nhập ngay, không màn trung gian.
      const { user } = await biometricApi.loginByBiometric();
      setUser(user);
      haptic.success();
      router.replace('/(tabs)');
    } catch (e: any) {
      haptic.error();
      setError(e?.message ?? 'Đăng nhập vân tay thất bại');
    } finally {
      setBioLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <View style={styles.logoBg}>
              <Text style={{ fontSize: 56 }}>🐝</Text>
            </View>
          </View>

          <Text style={[Typography.displayM, { marginTop: Space.s24, textAlign: 'center' }]}>Chào mừng trở lại</Text>
          <Text style={[Typography.bodyM, { color: Colors.textSecondary, textAlign: 'center', marginTop: 6 }]}>
            Đăng nhập để tiếp tục với BudgetBee
          </Text>

          <View style={{ marginTop: Space.s16, gap: Space.s16 }}>
            <TextField
              label="Email"
              icon="mail-outline"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="email@vidu.com"
            />
            <TextField
              label="Mật khẩu"
              icon="lock-closed-outline"
              secureTextEntry
              secureToggle
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              errorText={error ?? undefined}
            />
          </View>

          <Pressable
            onPress={() => router.push('/(auth)/forgot' as any)}
            style={{ alignSelf: 'flex-end', marginTop: Space.s12 }}
          >
            <Text style={[Typography.labelM, { color: Colors.primary }]}>Quên mật khẩu?</Text>
          </Pressable>

          <View style={styles.submitRow}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Đăng nhập" onPress={onSubmit} loading={loading} />
            </View>
            {bioHardware ? (
              <Pressable
                onPress={onBiometricLogin}
                style={styles.fingerQuickBtn}
                accessibilityRole="button"
                accessibilityLabel="Đăng nhập nhanh bằng vân tay"
              >
                <Ionicons name="finger-print" size={28} color={Colors.primaryDark} />
              </Pressable>
            ) : null}
            {bioHardware ? (
              <Pressable
                onPress={() => router.push('/face/scan?intent=login' as any)}
                style={styles.fingerQuickBtn}
                accessibilityRole="button"
                accessibilityLabel="Đăng nhập bằng khuôn mặt"
              >
                <Ionicons name="happy-outline" size={28} color={Colors.primaryDark} />
              </Pressable>
            ) : null}
          </View>

          {bioHardware ? (
            <Text style={[Typography.caption, styles.bioHint]}>
              Chạm vân tay hoặc khuôn mặt để đăng nhập nhanh — làm theo cửa sổ xác thực của máy.
            </Text>
          ) : null}

          <View style={styles.bottomRow}>
            <Text style={[Typography.bodyM, { color: Colors.textSecondary }]}>Chưa có tài khoản? </Text>
            <Link href="/(auth)/register" asChild>
              <Pressable>
                <Text style={[Typography.bodyM, { color: Colors.primary, fontWeight: '700' }]}>Đăng ký</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Space.pageHorizontal, paddingBottom: Space.s40 },
  logoWrap: { alignItems: 'center', marginTop: Space.s24 },
  logoBg: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.green,
  },
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    marginTop: Space.s24,
    ...Shadow.s,
  },
  bioIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', marginTop: Space.s24 },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  submitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: Space.s24 },
  bioHint: { color: Colors.textSecondary, textAlign: 'center', marginTop: Space.s12 },
  fingerQuickBtn: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.s,
  },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Space.s32 },
});
