import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Switch,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { secureStorage } from '@/services/secureStorage';
import { usePrefs } from '@/stores/prefs';
import { biometricService } from '@/services/biometric';
import { biometricApi } from '@/api/biometric';
import { authApi } from '@/api/auth';
import { BiometricCapability } from '@/types';
import { haptic } from '@/utils/haptics';
import { openOsBiometricSettings, osBiometricSettingsHint } from '@/utils/biometricSettings';

/**
 * Biometric setup — ONE unified toggle (Task 2).
 *
 * The old screen had two switches (Khuôn mặt + Vân tay). That split made no
 * sense: the OS already decides which modality a device uses, and binding two
 * separate credentials just doubled the surface for the "double scan" bug.
 *
 * Now there is a single switch "Đăng nhập bằng sinh trắc học":
 *   1. Turning it ON:
 *        - OS has no biometric enrolled → Alert + "Mở Cài đặt" CTA, stays OFF.
 *        - Else → password modal (re-auth the owner) → enrollBiometric().
 *          The OS biometric prompt fires EXACTLY ONCE during the Keystore
 *          save (see src/api/biometric.ts). Success → switch flips ON.
 *   2. Turning it OFF:
 *        - Confirm → wipe the device credential.
 *
 * `biometricService.primaryKind()` decides only the icon/label (face vs
 * finger); the underlying flow is identical either way.
 */
export default function BiometricSetupScreen() {
  const [bioEnrolled, setBioEnrolled] = useState(false);
  const [cap, setCap] = useState<BiometricCapability>('unavailable');
  const [kind, setKind] = useState<'face' | 'fingerprint'>('fingerprint');
  const setBio = usePrefs((s) => s.setBiometric);

  // Inline password modal state.
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Single in-flight guard so the user can't double-tap into two enrolments.
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBioEnrolled(await biometricApi.hasAnyEnrolled());
    setCap(await biometricService.getCapability());
    setKind(await biometricService.primaryKind());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Chỉ coi là "sẵn sàng" khi có sinh trắc THẬT (Face ID / vân tay) — không
  // chấp nhận thiết bị chỉ có mã PIN/passcode ('deviceCredential'). Bind
  // bio_token sau một keystore gated bằng PIN sẽ phá vỡ ý nghĩa "sinh trắc
  // học" và rơi vào nhánh lưu không-bảo-vệ (đã bị chặn ở secureKeystore).
  const osUnavailable = cap !== 'biometric';
  const kindLabel = kind === 'face' ? 'khuôn mặt' : 'vân tay';
  const kindIcon: keyof typeof Ionicons.glyphMap = kind === 'face' ? 'happy-outline' : 'finger-print';

  /** OS has nothing enrolled — offer the Settings deep-link. */
  function promptOpenSettings() {
    Alert.alert(
      'Thiết bị chưa bật sinh trắc học',
      'Hệ điều hành chưa đăng ký khuôn mặt / vân tay nào. Bật trong Cài đặt thiết bị trước, sau đó quay lại đây để bật trong BudgetBee.\n\n' +
        osBiometricSettingsHint(),
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Mở Cài đặt',
          onPress: async () => {
            const ok = await openOsBiometricSettings();
            if (!ok) Alert.alert('Không mở được Cài đặt', 'Vui lòng mở Cài đặt thủ công.');
          },
        },
      ],
    );
  }

  /** User flipped the switch. */
  async function onToggle(nextOn: boolean) {
    if (busy) return;
    haptic.light();

    if (nextOn) {
      // Re-check OS capability live so we never start an enrolment the OS
      // can't fulfil.
      const liveCap = await biometricService.getCapability();
      // Yêu cầu sinh trắc THẬT, không chỉ là passcode ('deviceCredential').
      // Chỉ 'biometric' mới cho bind bio_token sau khoá gated-bằng-sinh-trắc.
      if (liveCap !== 'biometric') {
        setCap(liveCap);
        promptOpenSettings();
        return;
      }
      setCap(liveCap);
      // Open the password re-auth modal; the actual enrol fires on confirm.
      setPwInput('');
      setPwError(null);
      setPwModalOpen(true);
      return;
    }

    // Turning OFF — confirm and wipe the device credential.
    Alert.alert(
      'Tắt đăng nhập sinh trắc?',
      'Bạn sẽ phải đăng nhập bằng email + mật khẩu trên thiết bị này.',
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
            }
          },
        },
      ],
    );
  }

  async function confirmPasswordAndEnroll() {
    if (!pwInput.trim()) {
      setPwError('Vui lòng nhập mật khẩu');
      haptic.error();
      return;
    }
    setPwBusy(true);
    setPwError(null);
    let passedPassword = false;
    try {
      const email = (await secureStorage.getUserEmail()) ?? '';
      if (!email) {
        setPwError('Không tìm thấy email — vui lòng đăng nhập lại');
        return;
      }
      // Re-authenticate the owner. Throws if the password is wrong.
      await authApi.login(email, pwInput);
      passedPassword = true;

      // Close the modal BEFORE the OS biometric prompt fires — an open modal
      // behind the OS popup looks broken on Android.
      setPwInput('');
      setPwModalOpen(false);
      setBusy(true);

      // ONE OS biometric prompt — fired inside the SecureStore save with
      // requireAuthentication=true. The device's primary modality is chosen
      // automatically; the caller never picks face-vs-finger.
      const { kind: enrolledKind } = await biometricApi.enrollBiometric();
      await setBio(true);
      haptic.success();
      Alert.alert(
        'Đã bật',
        enrolledKind === 'face'
          ? 'Lần đăng nhập tới, chạm "Đăng nhập bằng sinh trắc học" rồi xác thực bằng khuôn mặt.'
          : 'Lần đăng nhập tới, chạm "Đăng nhập bằng sinh trắc học" rồi xác thực bằng vân tay.',
      );
    } catch (e: any) {
      const msg = e?.message ?? 'Không bật được — vui lòng thử lại';
      // Password step failed → modal still open, show inline error.
      // Enrol/biometric step failed → modal already closed, surface an alert.
      if (!passedPassword) setPwError(msg);
      else Alert.alert('Không bật được', msg);
      haptic.error();
    } finally {
      setPwBusy(false);
      setBusy(false);
      refresh();
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={Colors.dark} />
        </Pressable>
        <Text style={Typography.headingM}>Sinh trắc học</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}>
        <Text style={[Typography.bodyM, { color: Colors.textSecondary, marginBottom: Space.s16 }]}>
          Bật đăng nhập nhanh bằng sinh trắc học của thiết bị. Hệ điều hành tự chọn khuôn mặt hay vân tay — bạn chỉ cần
          quét một lần.
        </Text>

        {osUnavailable ? (
          <View style={styles.gateBox}>
            <View style={styles.gateIcon}>
              <Ionicons name="warning" size={24} color={Colors.warning} />
            </View>
            <Text style={[Typography.headingS, { marginTop: 12, textAlign: 'center' }]}>
              Thiết bị chưa bật sinh trắc học
            </Text>
            <Text style={[Typography.bodyS, { color: Colors.textSecondary, marginTop: 6, textAlign: 'center' }]}>
              BudgetBee dùng vân tay / khuôn mặt của hệ điều hành — bạn cần bật chúng trong Cài đặt thiết bị trước.
              {'\n\n'}
              {osBiometricSettingsHint()}
            </Text>
            <Pressable
              onPress={async () => {
                haptic.light();
                const opened = await openOsBiometricSettings();
                if (!opened) {
                  Alert.alert('Không mở được Cài đặt', 'Vui lòng mở Cài đặt thiết bị thủ công.');
                }
              }}
              style={styles.gateCta}
            >
              <Ionicons name="settings-outline" size={18} color={Colors.white} />
              <Text style={[Typography.buttonM, { color: Colors.white, marginLeft: 8 }]}>Mở Cài đặt thiết bị</Text>
            </Pressable>
            <Pressable onPress={refresh} style={styles.gateRefresh}>
              <Text style={[Typography.buttonM, { color: Colors.primaryDark }]}>Tôi đã bật xong — Kiểm tra lại</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ONE unified biometric toggle */}
        <ToggleRow
          icon={kindIcon}
          iconBg="rgba(189,232,62,0.18)"
          iconColor={Colors.primaryDark}
          title="Đăng nhập bằng sinh trắc học"
          subtitle={
            osUnavailable
              ? 'Bật Face ID / vân tay trong Cài đặt thiết bị trước'
              : bioEnrolled
              ? `Đang bật — dùng ${kindLabel} để đăng nhập nhanh`
              : 'Dùng khuôn mặt hoặc vân tay thay vì nhập mật khẩu'
          }
          value={bioEnrolled}
          busy={busy}
          disabled={osUnavailable && !bioEnrolled}
          onValueChange={onToggle}
          onLockedTap={promptOpenSettings}
        />

        <View style={styles.usageCard}>
          <Text style={[Typography.labelL, { marginBottom: 8 }]}>Sinh trắc học dùng cho:</Text>
          <Bullet text="Đăng nhập nhanh không cần gõ mật khẩu" />
          <Bullet text="Xem số dư khi đang ẩn (chế độ riêng tư)" />
          <Bullet text="Xác nhận đổi mật khẩu" />
        </View>

        <View style={styles.usageCard}>
          <Text style={[Typography.labelL, { marginBottom: 8, color: Colors.warning }]}>Mã PIN (riêng) dùng cho:</Text>
          <Bullet text="Thêm tài khoản ngân hàng mới" />
          <Bullet text="Bật/tắt sinh trắc học" />
          <Bullet text="Đổi mã PIN (cần thêm OTP email)" />
        </View>
      </ScrollView>

      {/* Inline password modal — re-authenticate owner before enrolling. */}
      <Modal
        visible={pwModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (pwBusy) return;
          setPwModalOpen(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="key" size={28} color={Colors.primaryDark} />
            </View>
            <Text style={[Typography.headingM, { textAlign: 'center', marginTop: 12 }]}>Xác nhận mật khẩu</Text>
            <Text
              style={[
                Typography.bodyS,
                { color: Colors.textSecondary, textAlign: 'center', marginTop: 6, paddingHorizontal: 8 },
              ]}
            >
              Để bật đăng nhập sinh trắc, vui lòng nhập lại mật khẩu BudgetBee.
            </Text>

            <View style={styles.modalField}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} />
              <TextInput
                value={pwInput}
                onChangeText={(v) => {
                  setPwInput(v);
                  if (pwError) setPwError(null);
                }}
                placeholder="Mật khẩu BudgetBee"
                placeholderTextColor={Colors.grey400}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                style={styles.modalInput}
                onSubmitEditing={confirmPasswordAndEnroll}
                returnKeyType="go"
                editable={!pwBusy}
                autoFocus
              />
            </View>

            {pwError ? (
              <Text style={[Typography.caption, { color: Colors.expense, marginTop: 8, textAlign: 'center' }]}>
                {pwError}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <Pressable
                onPress={() => {
                  if (pwBusy) return;
                  setPwModalOpen(false);
                  setPwInput('');
                  setPwError(null);
                }}
                style={[styles.modalBtn, styles.modalBtnGhost]}
              >
                <Text style={[Typography.buttonM, { color: Colors.dark }]}>Huỷ</Text>
              </Pressable>
              <Pressable
                onPress={confirmPasswordAndEnroll}
                style={[styles.modalBtn, styles.modalBtnPrimary, pwBusy && { opacity: 0.6 }]}
                disabled={pwBusy}
              >
                {pwBusy ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={[Typography.buttonM, { color: Colors.white }]}>Tiếp tục</Text>
                )}
              </Pressable>
            </View>

            <Text
              style={[Typography.caption, { color: Colors.textSecondary, marginTop: 12, textAlign: 'center' }]}
            >
              Sau khi xác nhận, hệ điều hành sẽ hỏi quét sinh trắc 1 lần để gắn vào tài khoản.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function ToggleRow(props: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  value: boolean;
  busy: boolean;
  disabled: boolean;
  onValueChange: (v: boolean) => void;
  onLockedTap: () => void;
}) {
  const { icon, iconBg, iconColor, title, subtitle, value, busy, disabled, onValueChange, onLockedTap } = props;
  return (
    <Pressable
      onPress={disabled ? onLockedTap : undefined}
      style={[styles.row, value && styles.rowOn, disabled && styles.rowDisabled]}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={26} color={iconColor} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={Typography.headingS}>{title}</Text>
        <Text style={[Typography.bodyS, { color: Colors.textSecondary, marginTop: 2 }]}>{subtitle}</Text>
      </View>
      {busy ? (
        <ActivityIndicator color={Colors.primaryDark} style={{ marginRight: 8 }} />
      ) : (
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={busy || disabled}
          trackColor={{ false: Colors.grey200, true: Colors.primary }}
          thumbColor={value ? Colors.primaryDark : '#FFFFFF'}
        />
      )}
    </Pressable>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
      <Ionicons name="checkmark" size={16} color={Colors.income} style={{ marginTop: 2 }} />
      <Text style={[Typography.bodyS, { marginLeft: 8, flex: 1 }]}>{text}</Text>
    </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    ...Shadow.s,
  },
  rowOn: { borderColor: Colors.income, borderWidth: 2 },
  rowDisabled: { opacity: 0.65 },
  rowIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  gateBox: {
    padding: 18,
    borderRadius: Radius.l,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: Space.s16,
    alignItems: 'center',
  },
  gateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.dark,
    marginTop: 16,
    alignSelf: 'stretch',
  },
  gateRefresh: { marginTop: 10, paddingVertical: 8 },
  usageCard: {
    padding: 14,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    marginTop: Space.s16,
    ...Shadow.s,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.l,
    padding: 20,
    alignItems: 'center',
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(189,232,62,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalField: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 16,
    paddingHorizontal: 14,
    height: 52,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  modalInput: { flex: 1, marginLeft: 8, fontSize: 16, color: Colors.dark },
  modalBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  modalBtnGhost: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  modalBtnPrimary: { backgroundColor: Colors.primary },
});
