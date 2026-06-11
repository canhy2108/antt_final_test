import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space } from '@/theme';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { authApi } from '@/api/auth';
import { haptic } from '@/utils/haptics';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Vui lòng nhập họ tên';
    if (!email.trim()) e.email = 'Vui lòng nhập email';
    else if (!email.includes('@')) e.email = 'Email không hợp lệ';
    // Backend rule: min 12 chars + uncompromised (HaveIBeenPwned).
    if (password.length < 12) e.password = 'Mật khẩu tối thiểu 12 ký tự (yêu cầu bảo mật)';
    if (password !== confirm) e.confirm = 'Mật khẩu xác nhận không khớp';
    setErrors(e);
    if (Object.keys(e).length) {
      haptic.error();
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register({ name, email, password });
      haptic.success();
      router.push({
        pathname: '/(auth)/otp',
        params: {
          email: res.email,
          // In dev only — backend sends OTP code in response so we can
          // skip checking email. UI shows it as a hint banner.
          devOtp: res.dev_otp_code ?? '',
        },
      });
    } catch (err: any) {
      // Map backend validation messages to a relevant field where possible
      const msg = err?.message ?? 'Đăng ký thất bại';
      const lower = msg.toLowerCase();
      if (lower.includes('email')) setErrors({ email: msg });
      else if (lower.includes('mật khẩu') || lower.includes('password')) setErrors({ password: msg });
      else setErrors({ name: msg });
      haptic.error();
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.dark} />
          </Pressable>
          <Text style={[Typography.displayM, { marginTop: Space.s16 }]}>Tạo tài khoản</Text>
          <Text style={[Typography.bodyM, { color: Colors.textSecondary, marginTop: 6 }]}>
            Bắt đầu hành trình quản lý chi tiêu của bạn
          </Text>

          <View style={{ marginTop: Space.s24, gap: Space.s16 }}>
            <TextField label="Họ và tên" icon="person-outline" value={name} onChangeText={setName} errorText={errors.name} />
            <TextField
              label="Email"
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              errorText={errors.email}
            />
            <TextField
              label="Mật khẩu"
              icon="lock-closed-outline"
              secureTextEntry
              secureToggle
              value={password}
              onChangeText={setPassword}
              errorText={errors.password}
            />
            <TextField
              label="Xác nhận mật khẩu"
              icon="shield-checkmark-outline"
              secureTextEntry
              secureToggle
              value={confirm}
              onChangeText={setConfirm}
              errorText={errors.confirm}
            />
          </View>

          <PrimaryButton label="Tiếp tục" onPress={submit} loading={loading} style={{ marginTop: Space.s24 }} />

          <View style={styles.bottomRow}>
            <Text style={[Typography.bodyM, { color: Colors.textSecondary }]}>Đã có tài khoản? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={[Typography.bodyM, { color: Colors.primary, fontWeight: '700' }]}>Đăng nhập</Text>
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
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Space.s32 },
});
