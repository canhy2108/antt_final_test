import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/stores/auth';
import { userBiometricService } from '@/services/userBiometric';
import { haptic } from '@/utils/haptics';

/**
 * Login screen — server-side biometric quick-login (Alipay/WeChat pattern).
 *
 * The two large biometric buttons are ALWAYS visible. The user does NOT
 * have to type their email first — they just tap "Khuôn mặt" or "Vân tay",
 * the dedicated scan screen captures + sends to the server, and the server
 * matches against all enrolled users. The matched account is logged in
 * automatically.
 */
export default function LoginScreen() {
  const login = useAuth((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function onFaceLogin() {
    haptic.light();
    router.push('/biometric/face-login');
  }

  function onFingerLogin() {
    haptic.light();
    router.push('/biometric/finger-login');
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

          {/* BIOMETRIC — large, always-visible primary path (Alipay style) */}
          <View style={styles.bioRow}>
            <Pressable onPress={onFaceLogin} style={styles.bioBtn}>
              <View style={[styles.bioIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                <Ionicons name="happy-outline" size={32} color={Colors.info} />
              </View>
              <Text style={[Typography.labelL, { color: Colors.dark, marginTop: 8 }]}>Khuôn mặt</Text>
              <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>Nhanh nhất</Text>
            </Pressable>

            <Pressable onPress={onFingerLogin} style={styles.bioBtn}>
              <View style={[styles.bioIcon, { backgroundColor: 'rgba(189,232,62,0.18)' }]}>
                <Ionicons name="finger-print" size={32} color={Colors.primaryDark} />
              </View>
              <Text style={[Typography.labelL, { color: Colors.dark, marginTop: 8 }]}>Vân tay</Text>
              <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>Không cần email</Text>
            </Pressable>
          </View>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={[Typography.caption, { marginHorizontal: 12, color: Colors.textSecondary }]}>
              hoặc đăng nhập bằng mật khẩu
            </Text>
            <View style={styles.line} />
          </View>

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

          <PrimaryButton label="Đăng nhập" onPress={onSubmit} loading={loading} style={{ marginTop: Space.s24 }} />

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
  bioRow: { flexDirection: 'row', gap: 12, marginTop: Space.s24 },
  bioBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    ...Shadow.s,
  },
  bioIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', marginTop: Space.s24 },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Space.s32 },
});
