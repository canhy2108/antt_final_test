import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { authApi } from '@/api/auth';
import { useAuth } from '@/stores/auth';
import { haptic } from '@/utils/haptics';

const LEN = 6;

export default function OtpScreen() {
  const { email, devOtp: devOtpParam } = useLocalSearchParams<{ email?: string; devOtp?: string }>();
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''));
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string>(devOtpParam ?? '');
  const inputs = useRef<(TextInput | null)[]>([]);
  const setUser = useAuth((s) => s.setUser);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  function onChange(idx: number, v: string) {
    const ch = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = ch;
    setDigits(next);
    setError(null);
    if (ch && idx < LEN - 1) inputs.current[idx + 1]?.focus();
  }

  /** Autofill the 6 digits from a code string (used by the dev-OTP banner). */
  function applyCode(code: string) {
    const cleaned = code.replace(/\D/g, '').slice(0, LEN);
    if (cleaned.length !== LEN) return;
    setDigits(cleaned.split(''));
    setError(null);
    inputs.current[LEN - 1]?.focus();
    haptic.light();
  }

  async function submit() {
    if (!email) {
      setError('Thiếu email — vui lòng quay lại bước đăng ký.');
      haptic.error();
      return;
    }
    const code = digits.join('');
    if (code.length !== LEN) {
      setError('Vui lòng nhập đủ 6 chữ số');
      haptic.error();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const user = await authApi.verifyOtp(email, code);
      // verifyOtp persisted token + user info. Sync into the in-memory store.
      setUser(user);
      haptic.success();
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.message ?? 'Mã OTP không đúng');
      haptic.error();
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!email) return;
    try {
      const res = await authApi.resendOtp(email);
      setSeconds(60);
      setDigits(Array(LEN).fill(''));
      setDevOtp(res.dev_otp_code ?? '');
      setError(null);
      haptic.success();
      Alert.alert('Đã gửi lại mã', res.message ?? 'Kiểm tra hộp thư của bạn.');
    } catch (e: any) {
      Alert.alert('Lỗi gửi lại mã', e?.message ?? 'Không gửi lại được mã');
      haptic.error();
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ padding: Space.pageHorizontal, flex: 1 }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.dark} />
          </Pressable>

          <Text style={[Typography.displayM, { marginTop: Space.s16 }]}>Xác thực OTP</Text>
          <Text style={[Typography.bodyM, { color: Colors.textSecondary, marginTop: 6 }]}>
            Mã đã gửi tới <Text style={{ color: Colors.dark, fontWeight: '700' }}>{email || 'email của bạn'}</Text>
          </Text>

          {/* DEV-ONLY banner: backend echoes the OTP when APP_ENV=local */}
          {devOtp ? (
            <Pressable onPress={() => applyCode(devOtp)} style={styles.devBanner}>
              <Ionicons name="bug-outline" size={16} color={Colors.dark} />
              <Text style={[Typography.labelM, { marginLeft: 8, flex: 1 }]}>
                Mã DEV: <Text style={{ fontWeight: '800' }}>{devOtp}</Text>
              </Text>
              <Text style={[Typography.caption, { color: Colors.textSecondary }]}>bấm để nhập</Text>
            </Pressable>
          ) : null}

          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => {
                  inputs.current[i] = r;
                }}
                value={d}
                onChangeText={(v) => onChange(i, v)}
                onKeyPress={(e) => {
                  if (e.nativeEvent.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
                }}
                keyboardType="number-pad"
                maxLength={1}
                style={[
                  styles.cell,
                  d ? { borderColor: Colors.primary, borderWidth: 2 } : undefined,
                  Typography.headingL,
                  { textAlign: 'center' },
                ]}
              />
            ))}
          </View>
          {error ? <Text style={[Typography.caption, { color: Colors.expense, marginTop: 8 }]}>{error}</Text> : null}

          <PrimaryButton label="Xác nhận" onPress={submit} loading={loading} style={{ marginTop: Space.s24 }} />

          <View style={styles.resendRow}>
            <Text style={[Typography.bodyM, { color: Colors.textSecondary }]}>Không nhận được mã? </Text>
            {seconds > 0 ? (
              <Text style={[Typography.bodyM, { color: Colors.textSecondary }]}>Gửi lại sau {seconds}s</Text>
            ) : (
              <Pressable onPress={onResend}>
                <Text style={[Typography.bodyM, { color: Colors.primary, fontWeight: '700' }]}>Gửi lại</Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Space.s32 },
  cell: {
    width: 48,
    height: 56,
    borderRadius: Radius.m,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Space.s24 },
  devBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7', // amber-100 — clearly "dev" looking
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: Radius.m,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: Space.s16,
  },
});
