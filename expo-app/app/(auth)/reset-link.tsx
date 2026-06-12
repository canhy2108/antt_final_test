import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space } from '@/theme';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { authApi } from '@/api/auth';
import { haptic } from '@/utils/haptics';

const MIN_PW = 12; // khớp NIST + Password::min(12) ở backend

/**
 * TẦNG 2 — Đặt lại mật khẩu qua MAGIC LINK.
 *
 * Màn này được mở bằng deep link từ email: budgetbee://reset-link?token=...
 * expo-router tự định tuyến link tới đây và đưa `token` vào search params —
 * KHÔNG cần Linking listener thủ công.
 *
 * BẢO MẬT:
 *  - `token` CHỈ nằm trong bộ nhớ của màn này; KHÔNG log, KHÔNG ghi secure
 *    storage. Gửi thẳng lên server để verify (băm lại + so token_hash).
 *  - Token dùng-một-lần + hết hạn ngắn (server enforce). Người dùng chỉ cần
 *    nhập mật khẩu MỚI — không phải gõ mã.
 *  - Thành công ⇒ backend đã HUỶ mọi session/refresh token cũ. Màn này KHÔNG
 *    tự đăng nhập; đẩy về login để chứng minh biết mật khẩu mới.
 */
export default function ResetLinkScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasToken = typeof token === 'string' && token.length > 0;

  async function submit() {
    if (!hasToken) {
      setError('Liên kết không hợp lệ. Vui lòng yêu cầu liên kết mới.');
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
      // token chỉ truyền đi — không lưu, không log.
      await authApi.resetPasswordViaLink({ token: token as string, password });
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

  // Liên kết hỏng / thiếu token → hướng người dùng xin liên kết mới.
  if (!hasToken) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.wrap}>
          <Pressable onPress={() => router.replace('/(auth)/forgot')} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.dark} />
          </Pressable>
          <View style={styles.center}>
            <Ionicons name="link-outline" size={56} color={Colors.textSecondary} />
            <Text style={[Typography.headingL, { marginTop: Space.s16, textAlign: 'center' }]}>
              Liên kết không hợp lệ
            </Text>
            <Text
              style={[
                Typography.bodyM,
                { color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },
              ]}
            >
              Liên kết đặt lại có thể đã hết hạn hoặc đã được dùng. Hãy yêu cầu một liên kết mới.
            </Text>
            <PrimaryButton
              label="Yêu cầu liên kết mới"
              onPress={() => router.replace('/(auth)/forgot')}
              style={{ marginTop: Space.s24, alignSelf: 'stretch' }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.dark} />
          </Pressable>

          <Text style={[Typography.displayM, { marginTop: Space.s16 }]}>Đặt mật khẩu mới</Text>
          <Text style={[Typography.bodyM, { color: Colors.textSecondary, marginTop: 6 }]}>
            Bạn đang đặt lại mật khẩu qua liên kết an toàn. Nhập mật khẩu mới để hoàn tất.
          </Text>

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
  wrap: { padding: Space.pageHorizontal, flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: Space.s40 },
});
