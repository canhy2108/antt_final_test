import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { secureStorage } from '@/services/secureStorage';
import { biometricApi } from '@/api/biometric';
import { usePrefs } from '@/stores/prefs';
import { haptic } from '@/utils/haptics';
import { openOsBiometricSettings, osBiometricSettingsHint } from '@/utils/biometricSettings';

/**
 * Trang đăng ký VÂN TAY — chỉ một công tắc.
 *
 * Luồng tự động theo thao tác người dùng:
 *   1. Bật công tắc.
 *   2. Nếu MÁY chưa đăng ký vân tay nào (OS chưa có) → mở thẳng màn hình
 *      "Thêm vân tay" của hệ điều hành. Màn này chờ ở chế độ "đang chờ".
 *   3. Người dùng thêm vân tay trong Cài đặt rồi quay lại app → ta tự phát
 *      hiện (AppState 'active' + refocus), tự tiếp tục đăng ký trong app.
 *   4. Cửa sổ vân tay của OS bật 1 lần để gắn khoá → xong → tự về trang chủ.
 *
 * Vì người dùng đã đăng nhập sẵn trong app và cửa sổ vân tay của OS vẫn bật
 * khi gắn khoá, ta bỏ bước nhập lại mật khẩu để đúng yêu cầu "chỉ cần bật
 * công tắc". (Muốn chặt hơn có thể thêm lại xác nhận mật khẩu ở đây.)
 */
type Phase = 'idle' | 'awaiting-os-enroll' | 'enrolling' | 'done';

export default function FingerprintSetupScreen() {
  const setBio = usePrefs((s) => s.setBiometric);

  const [enrolled, setEnrolled] = useState(false);
  const [hasHardware, setHasHardware] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [busy, setBusy] = useState(false);

  // True trong lúc ta chủ động đưa người dùng sang Cài đặt OS để thêm vân tay.
  const awaitingRef = useRef(false);

  const refresh = useCallback(async () => {
    setHasHardware(await LocalAuthentication.hasHardwareAsync().catch(() => false));
    setEnrolled(await secureStorage.isFingerprintEnrolled());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Khi quay lại màn này (từ Cài đặt OS), kiểm tra lại trạng thái.
  useFocusEffect(
    useCallback(() => {
      refresh();
      if (awaitingRef.current) tryContinueAfterOsEnroll();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refresh]),
  );

  // Phát hiện app trở lại foreground sau khi người dùng thêm vân tay trong OS.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && awaitingRef.current) {
        tryContinueAfterOsEnroll();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Sau khi người dùng quay lại từ Cài đặt: nếu OS đã có vân tay → đăng ký tiếp. */
  async function tryContinueAfterOsEnroll() {
    const osEnrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
    if (!osEnrolled) {
      // Vẫn chưa thêm — giữ trạng thái chờ, người dùng có thể bấm thử lại.
      return;
    }
    awaitingRef.current = false;
    await doEnroll();
  }

  /** Đăng ký credential vân tay trong app rồi về trang chủ. */
  async function doEnroll() {
    if (busy) return;
    setBusy(true);
    setPhase('enrolling');
    try {
      // Cửa sổ vân tay của OS bật 1 lần bên trong (gắn khoá Keystore).
      await biometricApi.enrollBiometric({ kind: 'fingerprint' });
      await setBio(true);
      await refresh();
      haptic.success();
      setPhase('done');
      // Tự về trang chủ theo yêu cầu.
      setTimeout(() => router.replace('/(tabs)'), 700);
    } catch (e: any) {
      haptic.error();
      setPhase('idle');
      Alert.alert('Không bật được vân tay', e?.message ?? 'Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(nextOn: boolean) {
    haptic.light();

    // TẮT vân tay
    if (!nextOn) {
      Alert.alert(
        'Tắt đăng nhập vân tay?',
        'Bạn sẽ cần đăng nhập bằng email + mật khẩu trên thiết bị này.',
        [
          { text: 'Huỷ', style: 'cancel' },
          {
            text: 'Tắt',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                await biometricApi.clearAll();
                await setBio(false);
                haptic.success();
              } finally {
                await refresh();
                setBusy(false);
                setPhase('idle');
              }
            },
          },
        ],
      );
      return;
    }

    // BẬT vân tay
    const hw = await LocalAuthentication.hasHardwareAsync().catch(() => false);
    if (!hw) {
      Alert.alert('Không hỗ trợ', 'Thiết bị này không có cảm biến vân tay.');
      return;
    }

    const osEnrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
    if (!osEnrolled) {
      // Máy chưa có vân tay → đưa người dùng sang đăng ký của hệ điều hành.
      awaitingRef.current = true;
      setPhase('awaiting-os-enroll');
      const opened = await openOsBiometricSettings();
      if (!opened) {
        awaitingRef.current = false;
        setPhase('idle');
        Alert.alert('Không mở được Cài đặt', 'Vui lòng vào Cài đặt thiết bị để thêm vân tay.');
      }
      return;
    }

    // Máy đã có vân tay → đăng ký luôn trong app.
    await doEnroll();
  }

  // -------------------------------------------------------------- render --

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={Colors.dark} />
        </Pressable>
        <Text style={Typography.headingM}>Vân tay</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.hub}>
          <Ionicons name="finger-print" size={72} color={Colors.primaryDark} />
        </View>

        <Text style={[Typography.headingL, styles.title]}>Đăng nhập bằng vân tay</Text>
        <Text style={[Typography.bodyM, styles.hint]}>
          {phase === 'awaiting-os-enroll'
            ? 'Hãy thêm vân tay trong Cài đặt thiết bị rồi quay lại — app sẽ tự tiếp tục.'
            : phase === 'enrolling'
            ? 'Đang gắn vân tay với tài khoản…'
            : phase === 'done'
            ? 'Đã bật! Đang đưa bạn về trang chủ…'
            : 'Dùng vân tay đã đăng ký trên điện thoại để đăng nhập nhanh, không cần gõ mật khẩu.'}
        </Text>

        {phase === 'awaiting-os-enroll' ? (
          <Text style={[Typography.bodyS, styles.osHint]}>{osBiometricSettingsHint()}</Text>
        ) : null}

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={Typography.headingS}>Bật đăng nhập vân tay</Text>
            <Text style={[Typography.bodyS, { color: Colors.textSecondary, marginTop: 2 }]}>
              {enrolled ? 'Đang bật' : 'Đang tắt'}
            </Text>
          </View>
          {busy || phase === 'enrolling' ? (
            <ActivityIndicator color={Colors.primaryDark} style={{ marginRight: 8 }} />
          ) : (
            <Switch
              value={enrolled || phase === 'awaiting-os-enroll'}
              onValueChange={onToggle}
              disabled={busy}
              trackColor={{ false: Colors.grey200, true: Colors.primary }}
              thumbColor={enrolled ? Colors.primaryDark : '#FFFFFF'}
            />
          )}
        </View>

        {phase === 'awaiting-os-enroll' ? (
          <Pressable
            onPress={async () => {
              await openOsBiometricSettings();
            }}
            style={styles.againBtn}
          >
            <Ionicons name="settings-outline" size={18} color={Colors.white} />
            <Text style={[Typography.buttonM, { color: Colors.white, marginLeft: 8 }]}>
              Mở lại Cài đặt vân tay
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.pageHorizontal,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40 },
  hub: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(189,232,62,0.12)',
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { textAlign: 'center', marginTop: 28 },
  hint: { color: Colors.textSecondary, textAlign: 'center', marginTop: 10 },
  osHint: { color: Colors.textSecondary, textAlign: 'center', marginTop: 12 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 32,
    padding: 16,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.s,
  },
  againBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.dark,
  },
});
