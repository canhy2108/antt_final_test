import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius } from '@/theme';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { authApi } from '@/api/auth';
import { haptic } from '@/utils/haptics';

const LEN = 6;
const MIN_PW = 12; // khớp NIST + Password::min(12) ở backend

/**
 * Quên mật khẩu — BƯỚC 2: nhập OTP + đặt mật khẩu mới.
 *
 * Khi đặt lại thành công, backend đã HUỶ toàn bộ session/refresh token cũ
 * của tài khoản. Màn này KHÔNG tự đăng nhập — ta đẩy người dùng về màn
 * login để đăng nhập lại bằng mật khẩu mới (chứng minh họ thật sự biết nó).
 */
export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();

  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(TextInput | null)[]>([]);

  function onChangeDigit(idx: number, v: string) {
    const ch = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = ch;
    setDigits(next);
    setError(null);
    if (ch && idx < LEN - 1) inputs.current[idx + 1]?.focus();
  }

  async function submit() {
    if (!email) {
      setError('Thiếu email — vui lòng quay lại bước trước.');
      haptic.error();
      return;
    }
    const code = digits.join('');
    if (code.length !== LEN) {
      setError('Vui lòng nhập đủ 6 chữ số mã OTP');
      haptic.error();
      return;
    }
    if (password.length < MIN_PW) {
      setError(`Mật khẩu mới phải tối thiểu ${MIN_PW} ký tự`);
      haptic.error();
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp');
      haptic.error();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await authApi.resetPassword({ email, code, password });
      haptic.success();
      Alert.alert(
        'Đổi mật khẩu thành công',
        'Mọi phiên đăng nhập cũ đã được đăng xuất. Vui lòng đăng nhập lại bằng mật khẩu mới.',
        [{ text: 'Đăng nhập', onPress: () => router.replace('/(auth)/login') }],
      );
    } catch (e: any) {
      setError(e?.message ?? 'Không đặt lại được mật khẩu');
      haptic.error();
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.dark} />
          </Pressable>

          <Text style={[Typography.displayM, { marginTop: Space.s16 }]}>Đặt lại mật khẩu</Text>
          <Text style={[Typography.bodyM, { color: Colors.textSecondary, marginTop: 6 }]}>
            Nhập mã đã gửi tới{' '}
            <Text style={{ color: Colors.dark, fontWeight: '700' }}>{email || 'email của bạn'}</Text>{' '}
            và đặt mật khẩu mới
          </Text>

          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => {
                  inputs.current[i] = r;
                }}
                value={d}
                onChangeText={(v) => onChangeDigit(i, v)}
                onKeyPress={(e) => {
                  if (e.nativeEvent.key === 'Backspace' && !digits[i] && i > 0) {
                    inputs.current[i - 1]?.focus();
                  }
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

          <View style={{ marginTop: Space.s24, gap: Space.s16 }}>
            <TextField
              label="Mật khẩu mới"
              icon="lock-closed-outline"
              secureTextEntry
              secureToggle
              autoCapitalize="none"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (error) setError(null);
              }}
              placeholder={`Tối thiểu ${MIN_PW} ký tự`}
            />
            <TextField
              label="Xác nhận mật khẩu mới"
              icon="lock-closed-outline"
              secureTextEntry
              secureToggle
              autoCapitalize="none"
              value={confirm}
              onChangeText={(v) => {
                setConfirm(v);
                if (error) setError(null);
              }}
              placeholder="Nhập lại mật khẩu mới"
              errorText={error ?? undefined}
            />
          </View>

          <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: Space.s12 }]}>
            Mật khẩu cần tối thiểu {MIN_PW} ký tự và không nằm trong danh sách mật khẩu đã bị lộ.
          </Text>

          <PrimaryButton
            label="Đặt lại mật khẩu"
            onPress={submit}
            loading={loading}
            style={{ marginTop: Space.s24 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Space.s24 },
  cell: {
    width: 48,
    height: 56,
    borderRadius: Radius.m,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
