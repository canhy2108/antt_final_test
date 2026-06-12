import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius } from '@/theme';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { authApi } from '@/api/auth';
import { haptic } from '@/utils/haptics';

/**
 * Quên mật khẩu — BƯỚC 1 (TẦNG 2 mặc định: MAGIC LINK).
 *
 * Luồng chính: gửi email chứa liên kết mở thẳng app (budgetbee://reset-link)
 * → người dùng KHÔNG phải gõ mã 6 số tay. Backend LUÔN trả message chung "nếu
 * email tồn tại…" nên dù email có thật hay không, ta đều hiện màn "kiểm tra
 * email" — không lộ email nào đã đăng ký (chống account enumeration).
 *
 * Luồng dự phòng (fallback): "Dùng mã OTP" gọi /forgot-password (OTP purpose
 * riêng) rồi sang màn reset-password gõ tay — giữ lại cho ai không mở được link.
 */
export default function ForgotScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false); // gửi link
  const [otpLoading, setOtpLoading] = useState(false); // fallback OTP
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sentMinutes, setSentMinutes] = useState<number | undefined>(undefined);

  function validEmail(): string | null {
    const e = email.trim().toLowerCase();
    if (!e.includes('@')) {
      setError('Vui lòng nhập email hợp lệ');
      haptic.error();
      return null;
    }
    return e;
  }

  async function sendLink() {
    const e = validEmail();
    if (!e) return;
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.requestResetLink(e);
      haptic.success();
      setSentMinutes(res?.expires_in_minutes);
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? 'Không gửi được liên kết đặt lại');
      haptic.error();
    } finally {
      setLoading(false);
    }
  }

  async function useOtpInstead() {
    const e = validEmail();
    if (!e) return;
    setError(null);
    setOtpLoading(true);
    try {
      await authApi.forgotPassword(e);
      haptic.success();
      router.push({ pathname: '/(auth)/reset-password', params: { email: e } });
    } catch (err: any) {
      setError(err?.message ?? 'Không gửi được mã đặt lại');
      haptic.error();
    } finally {
      setOtpLoading(false);
    }
  }

  // ---- Trạng thái ĐÃ GỬI LINK: hướng dẫn mở email ----
  if (sent) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.wrap}>
          <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.dark} />
          </Pressable>

          <View style={styles.iconBadge}>
            <Ionicons name="mail-unread-outline" size={36} color={Colors.primaryDark} />
          </View>

          <Text style={[Typography.displayM, { marginTop: Space.s16 }]}>Kiểm tra email</Text>
          <Text style={[Typography.bodyM, { color: Colors.textSecondary, marginTop: 8, lineHeight: 22 }]}>
            Nếu <Text style={{ color: Colors.dark, fontWeight: '700' }}>{email.trim().toLowerCase()}</Text>{' '}
            đã đăng ký, chúng tôi vừa gửi một liên kết đặt lại mật khẩu. Mở email và nhấn vào liên kết —
            ứng dụng BudgetBee sẽ tự mở để bạn đặt mật khẩu mới.
          </Text>
          {sentMinutes ? (
            <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: Space.s12 }]}>
              Liên kết có hiệu lực trong {sentMinutes} phút và chỉ dùng được một lần.
            </Text>
          ) : null}

          <PrimaryButton
            label="Gửi lại liên kết"
            variant="outline"
            onPress={sendLink}
            loading={loading}
            style={{ marginTop: Space.s24 }}
          />
          <PrimaryButton
            label="Dùng mã OTP để nhập tay"
            variant="ghost"
            onPress={useOtpInstead}
            loading={otpLoading}
            style={{ marginTop: Space.s8 }}
          />

          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            style={{ alignSelf: 'center', marginTop: Space.s16 }}
            hitSlop={8}
          >
            <Text style={[Typography.labelM, { color: Colors.textSecondary }]}>Quay lại đăng nhập</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ---- Trạng thái nhập email ----
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.wrap}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.dark} />
          </Pressable>
          <Text style={[Typography.displayM, { marginTop: Space.s16 }]}>Quên mật khẩu</Text>
          <Text style={[Typography.bodyM, { color: Colors.textSecondary, marginTop: 6, lineHeight: 22 }]}>
            Nhập email đã đăng ký. Chúng tôi sẽ gửi một liên kết an toàn để bạn đặt lại mật khẩu —
            không cần gõ mã.
          </Text>
          <View style={{ marginTop: Space.s24 }}>
            <TextField
              label="Email"
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (error) setError(null);
              }}
              errorText={error ?? undefined}
            />
          </View>
          <PrimaryButton
            label="Gửi liên kết đặt lại"
            onPress={sendLink}
            loading={loading}
            style={{ marginTop: Space.s24 }}
          />
          <PrimaryButton
            label="Dùng mã OTP để nhập tay"
            variant="ghost"
            onPress={useOtpInstead}
            loading={otpLoading}
            style={{ marginTop: Space.s8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  wrap: { padding: Space.pageHorizontal, flexGrow: 1 },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: Radius.l,
    backgroundColor: 'rgba(189,232,62,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.s24,
  },
});
