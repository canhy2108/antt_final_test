import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { secureStorage } from '@/services/secureStorage';
import { usePrefs } from '@/stores/prefs';
import { biometricService } from '@/services/biometric';
import { biometricApi } from '@/api/biometric';
import { BiometricCapability } from '@/types';
import { haptic } from '@/utils/haptics';

/**
 * Biometric chooser screen. Tapping "Sinh trắc học" in Settings now lands
 * here instead of toggling a single switch — gives the user two distinct
 * enrollment options (Face / Fingerprint) and an explicit "Tắt" path.
 */
export default function BiometricSetupScreen() {
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [fingerEnrolled, setFingerEnrolled] = useState(false);
  const [cap, setCap] = useState<BiometricCapability>('unavailable');
  const setBio = usePrefs((s) => s.setBiometric);

  const refresh = useCallback(async () => {
    setFaceEnrolled((await secureStorage.isFaceEnrolled?.()) ?? false);
    setFingerEnrolled((await secureStorage.isFingerprintEnrolled?.()) ?? false);
    setCap(await biometricService.getCapability());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh enrollment state whenever the user returns from a scan screen
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const anyEnrolled = faceEnrolled || fingerEnrolled;

  async function disableAll() {
    Alert.alert(
      'Tắt sinh trắc học?',
      'Bạn sẽ phải đăng nhập bằng email + mật khẩu mỗi lần. Mật khẩu lưu cho đăng nhập nhanh sẽ bị xoá.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Tắt',
          style: 'destructive',
          onPress: async () => {
            await biometricApi.clearAll();
            await setBio(false);
            haptic.success();
            refresh();
          },
        },
      ],
    );
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
          Chọn phương thức bạn muốn dùng để mở khoá BudgetBee và xác nhận các thao tác bảo mật cao.
        </Text>

        {/* Face scan option */}
        <Pressable
          onPress={() => {
            haptic.light();
            router.push('/biometric/face-scan');
          }}
          style={[styles.optionCard, faceEnrolled && { borderColor: Colors.income, borderWidth: 2 }]}
        >
          <View style={[styles.optionIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <Ionicons name="happy-outline" size={28} color={Colors.info} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={styles.titleRow}>
              <Text style={Typography.headingS}>Quét khuôn mặt</Text>
              {faceEnrolled ? <StatusPill ok label="Đã đăng ký" /> : null}
            </View>
            <Text style={[Typography.bodyS, { marginTop: 2 }]}>
              Đưa khuôn mặt vào khung oval — tháo kính, vén tóc để lộ trán
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.grey400} />
        </Pressable>

        {/* Fingerprint scan option */}
        <Pressable
          onPress={() => {
            haptic.light();
            router.push('/biometric/fingerprint-scan');
          }}
          style={[styles.optionCard, fingerEnrolled && { borderColor: Colors.income, borderWidth: 2 }]}
        >
          <View style={[styles.optionIcon, { backgroundColor: 'rgba(189,232,62,0.18)' }]}>
            <Ionicons name="finger-print" size={28} color={Colors.primaryDark} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={styles.titleRow}>
              <Text style={Typography.headingS}>Quét vân tay</Text>
              {fingerEnrolled ? <StatusPill ok label="Đã đăng ký" /> : null}
            </View>
            <Text style={[Typography.bodyS, { marginTop: 2 }]}>
              Đặt ngón tay lên cảm biến vân tay của thiết bị
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.grey400} />
        </Pressable>

        {/* Capability warning */}
        {cap === 'unavailable' ? (
          <View style={styles.warnBox}>
            <Ionicons name="warning-outline" size={20} color={Colors.warning} />
            <Text style={[Typography.bodyS, { color: Colors.warning, marginLeft: 8, flex: 1 }]}>
              Thiết bị chưa cài vân tay / khuôn mặt. Hãy bật trong{' '}
              <Text style={{ fontWeight: '700' }}>Cài đặt thiết bị → Bảo mật</Text>.
            </Text>
          </View>
        ) : null}

        {/* Usage hint */}
        <View style={styles.usageCard}>
          <Text style={[Typography.labelL, { marginBottom: 8 }]}>Sinh trắc học sẽ dùng cho:</Text>
          <Bullet text="Đăng nhập nhanh không cần gõ mật khẩu" />
          <Bullet text="Xem số dư khi đang ẩn (chế độ riêng tư)" />
          <Bullet text="Xác nhận khi thay đổi mật khẩu" />
        </View>

        <View style={styles.usageCard}>
          <Text style={[Typography.labelL, { marginBottom: 8, color: Colors.warning }]}>
            Mã PIN (riêng) sẽ dùng cho:
          </Text>
          <Bullet text="Thêm tài khoản ngân hàng mới" />
          <Bullet text="Bật / tắt / đổi sinh trắc học" />
          <Bullet text="Thay đổi mã PIN (cần thêm OTP email)" />
        </View>

        {/* Disable */}
        {anyEnrolled ? (
          <Pressable onPress={disableAll} style={styles.disableBtn}>
            <Ionicons name="close-circle-outline" size={20} color={Colors.expense} />
            <Text style={[Typography.buttonM, { color: Colors.expense, marginLeft: 8 }]}>
              Tắt sinh trắc học
            </Text>
          </Pressable>
        ) : null}

        {/* Exit */}
        <Pressable
          onPress={() => router.back()}
          style={[styles.exitBtn, !anyEnrolled && { marginTop: Space.s24 }]}
        >
          <Text style={[Typography.buttonL, { color: Colors.dark }]}>Thoát</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View
      style={{
        marginLeft: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        backgroundColor: ok ? Colors.income + '20' : Colors.grey200,
      }}
    >
      <Text style={[Typography.caption, { color: ok ? Colors.income : Colors.textSecondary, fontWeight: '700' }]}>
        {label}
      </Text>
    </View>
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
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 12,
    ...Shadow.s,
  },
  optionIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.m,
    backgroundColor: '#FEF3C7',
    marginTop: 8,
  },
  usageCard: {
    padding: 14,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    marginTop: Space.s16,
    ...Shadow.s,
  },
  disableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: Space.s24,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.expense,
  },
  exitBtn: {
    paddingVertical: 14,
    marginTop: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
});
