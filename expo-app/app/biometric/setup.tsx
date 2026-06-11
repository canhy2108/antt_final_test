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
 * Biometric setup screen — iOS-Settings-style toggle switches.
 *
 * Behaviour per spec:
 *   1. The user sees two switches: "Đăng nhập khuôn mặt" + "Đăng nhập vân tay".
 *   2. Turning a switch ON:
 *        - If the OS has no biometric enrolled → Alert with "Mở Cài đặt"
 *          CTA, switch stays OFF.
 *        - Else → inline password modal (re-auth the owner) → on confirm,
 *          call enrollFace/enrollFingerprint. The OS biometric prompt
 *          fires ONCE during Keystore save (see src/api/biometric.ts).
 *          Success → switch flips ON. Failure → switch stays OFF + Alert.
 *   3. Turning a switch OFF:
 *        - Confirm dialog → clears the device credential for that kind.
 *
 * No more "scan-and-confirm" full-screen flow for enrolment — the user
 * never has to dig through a camera animation just to flip a setting,
 * which matches how every banking app actually does it.
 */
type Kind = 'face' | 'fingerprint';

export default function BiometricSetupScreen() {
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [fingerEnrolled, setFingerEnrolled] = useState(false);
  const [cap, setCap] = useState<BiometricCapability>('unavailable');
  const setBio = usePrefs((s) => s.setBiometric);

  // Inline password modal state — used by both switches.
  const [pwModalKind, setPwModalKind] = useState<Kind | null>(null);
  const [pwInput, setPwInput] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Optimistic toggle state — the Switch is controlled, but the underlying
  // enrolment is async. We track which kind is mid-flight so the user can't
  // double-tap and start two enrolments.
  const [busyKind, setBusyKind] = useState<Kind | null>(null);

  const refresh = useCallback(async () => {
    setFaceEnrolled((await secureStorage.isFaceEnrolled?.()) ?? false);
    setFingerEnrolled((await secureStorage.isFingerprintEnrolled?.()) ?? false);
    setCap(await biometricService.getCapability());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const isFaceOn = faceEnrolled;
  const isFingerOn = fingerEnrolled;
  const osUnavailable = cap === 'unavailable';

  /**
   * Pressed the OS-not-enrolled gate or a disabled switch. Show the
   * Settings deep-link option.
   */
  function promptOpenSettings(kind: Kind) {
    Alert.alert(
      kind === 'face' ? 'Thiết bị chưa bật khuôn mặt' : 'Thiết bị chưa đăng ký vân tay',
      'Hệ điều hành chưa đăng ký sinh trắc nào. Bật trong Cài đặt thiết bị trước, sau đó quay lại đây để bật trong BudgetBee.\n\n' +
        osBiometricSettingsHint(),
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Mở Cài đặt',
          onPress: async () => {
            const ok = await openOsBiometricSettings();
            if (!ok) {
              Alert.alert('Không mở được Cài đặt', 'Vui lòng mở Cài đặt thủ công.');
            }
          },
        },
      ],
    );
  }

  /**
   * User flipped a switch. Decide enrol vs unenrol based on current state.
   */
  async function onToggle(kind: Kind, nextOn: boolean) {
    if (busyKind) return;
    haptic.light();

    if (nextOn) {
      // Turning ON — first re-check OS capability so we never trigger an
      // enrolment that the OS can't fulfil.
      const liveCap = await biometricService.getCapability();
      if (liveCap === 'unavailable') {
        setCap('unavailable');
        promptOpenSettings(kind);
        return;
      }
      setCap(liveCap);
      // Open the password re-auth modal; the actual enrol fires when the
      // user confirms inside the modal.
      setPwInput('');
      setPwError(null);
      setPwModalKind(kind);
      return;
    }

    // Turning OFF — confirm and clear.
    Alert.alert(
      kind === 'face' ? 'Tắt đăng nhập khuôn mặt?' : 'Tắt đăng nhập vân tay?',
      'Bạn sẽ phải đăng nhập bằng email + mật khẩu cho phương thức này.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Tắt',
          style: 'destructive',
          onPress: async () => {
            setBusyKind(kind);
            try {
              // Wipe only the kind the user toggled off. The other kind
              // and the global "biometric enabled" flag stay intact.
              await biometricApi.clearAll();
              if (kind === 'face') {
                await secureStorage.setFaceEnrolled(false);
              } else {
                await secureStorage.setFingerprintEnrolled(false);
              }
              // If both kinds are now off, also flip the global pref.
              const stillFace = kind !== 'face' && (await secureStorage.isFaceEnrolled());
              const stillFinger = kind !== 'fingerprint' && (await secureStorage.isFingerprintEnrolled());
              if (!stillFace && !stillFinger) {
                await setBio(false);
              }
              haptic.success();
            } finally {
              await refresh();
              setBusyKind(null);
            }
          },
        },
      ],
    );
  }

  async function confirmPasswordAndEnroll() {
    if (!pwModalKind) return;
    const kind = pwModalKind;
    if (!pwInput.trim()) {
      setPwError('Vui lòng nhập mật khẩu');
      haptic.error();
      return;
    }
    setPwBusy(true);
    setPwError(null);
    try {
      const email = (await secureStorage.getUserEmail()) ?? '';
      if (!email) {
        setPwError('Không tìm thấy email — vui lòng đăng nhập lại');
        return;
      }
      // Re-authenticate the owner. Throws if password is wrong.
      await authApi.login(email, pwInput);

      // Close the modal BEFORE the OS biometric prompt fires — keeping
      // the modal open while the OS popup is up looks broken on Android.
      setPwInput('');
      setPwModalKind(null);
      setBusyKind(kind);

      // The OS biometric prompt fires inside the SecureStore save with
      // requireAuthentication=true. One prompt only — see src/api/biometric.ts.
      if (kind === 'face') {
        await biometricApi.enrollFace(`face:${email}`);
      } else {
        await biometricApi.enrollFingerprint(`finger:${email}`);
      }
      await setBio(true);
      haptic.success();
      Alert.alert(
        'Đã bật',
        kind === 'face'
          ? 'Lần đăng nhập tới bạn có thể chạm "Khuôn mặt" trên màn hình login.'
          : 'Lần đăng nhập tới bạn có thể chạm "Vân tay" trên màn hình login.',
      );
    } catch (e: any) {
      const msg = e?.message ?? 'Không bật được — vui lòng thử lại';
      // If the modal was closed (i.e. we got past password verify and the
      // failure came from enrol/biometric prompt), surface a top-level alert.
      if (pwModalKind) {
        setPwError(msg);
      } else {
        Alert.alert('Không bật được', msg);
      }
      haptic.error();
    } finally {
      setPwBusy(false);
      setBusyKind(null);
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
          Bật/tắt nhanh các phương thức đăng nhập sinh trắc cho BudgetBee.
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
              <Text style={[Typography.buttonM, { color: Colors.white, marginLeft: 8 }]}>
                Mở Cài đặt thiết bị
              </Text>
            </Pressable>
            <Pressable onPress={refresh} style={styles.gateRefresh}>
              <Text style={[Typography.buttonM, { color: Colors.primaryDark }]}>
                Tôi đã bật xong — Kiểm tra lại
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Face toggle */}
        <ToggleRow
          icon="happy-outline"
          iconBg="rgba(59,130,246,0.12)"
          iconColor={Colors.info}
          title="Đăng nhập bằng khuôn mặt"
          subtitle={
            osUnavailable
              ? 'Bật Face ID / Face Unlock trong Cài đặt trước'
              : isFaceOn
              ? 'Đang bật — chạm "Khuôn mặt" trên màn hình login'
              : 'Cho phép quét khuôn mặt thay vì nhập mật khẩu'
          }
          value={isFaceOn}
          busy={busyKind === 'face'}
          disabled={osUnavailable && !isFaceOn}
          onValueChange={(v) => onToggle('face', v)}
          onLockedTap={() => promptOpenSettings('face')}
        />

        {/* Fingerprint toggle */}
        <ToggleRow
          icon="finger-print"
          iconBg="rgba(189,232,62,0.18)"
          iconColor={Colors.primaryDark}
          title="Đăng nhập bằng vân tay"
          subtitle={
            osUnavailable
              ? 'Đăng ký vân tay trong Cài đặt thiết bị trước'
              : isFingerOn
              ? 'Đang bật — chạm "Vân tay" trên màn hình login'
              : 'Cho phép quét vân tay thay vì nhập mật khẩu'
          }
          value={isFingerOn}
          busy={busyKind === 'fingerprint'}
          disabled={osUnavailable && !isFingerOn}
          onValueChange={(v) => onToggle('fingerprint', v)}
          onLockedTap={() => promptOpenSettings('fingerprint')}
        />

        <View style={styles.usageCard}>
          <Text style={[Typography.labelL, { marginBottom: 8 }]}>Sinh trắc học dùng cho:</Text>
          <Bullet text="Đăng nhập nhanh không cần gõ mật khẩu" />
          <Bullet text="Xem số dư khi đang ẩn (chế độ riêng tư)" />
          <Bullet text="Xác nhận đổi mật khẩu" />
        </View>

        <View style={styles.usageCard}>
          <Text style={[Typography.labelL, { marginBottom: 8, color: Colors.warning }]}>
            Mã PIN (riêng) dùng cho:
          </Text>
          <Bullet text="Thêm tài khoản ngân hàng mới" />
          <Bullet text="Bật/tắt sinh trắc học" />
          <Bullet text="Đổi mã PIN (cần thêm OTP email)" />
        </View>
      </ScrollView>

      {/* Inline password modal — re-authenticate owner before enrolling. */}
      <Modal
        visible={pwModalKind !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (pwBusy) return;
          setPwModalKind(null);
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
            <Text style={[Typography.headingM, { textAlign: 'center', marginTop: 12 }]}>
              Xác nhận mật khẩu
            </Text>
            <Text
              style={[
                Typography.bodyS,
                { color: Colors.textSecondary, textAlign: 'center', marginTop: 6, paddingHorizontal: 8 },
              ]}
            >
              {pwModalKind === 'face'
                ? 'Để bật đăng nhập khuôn mặt, vui lòng nhập lại mật khẩu BudgetBee.'
                : 'Để bật đăng nhập vân tay, vui lòng nhập lại mật khẩu BudgetBee.'}
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
                  setPwModalKind(null);
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
              style={[
                Typography.caption,
                { color: Colors.textSecondary, marginTop: 12, textAlign: 'center' },
              ]}
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
