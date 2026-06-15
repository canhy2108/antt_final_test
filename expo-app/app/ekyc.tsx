import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { biometricService } from '@/services/biometric';
import { BiometricCapability } from '@/types';
import { haptic } from '@/utils/haptics';

/**
 * "Biometric Gate" — replaces the previous fake camera-based eKYC.
 *
 * The previous screen claimed to verify the user's face by capturing a few
 * photos and pretending — which never matched the photo against anything.
 * That is both a privacy footgun (stores face images) and a trust hazard.
 *
 * This version delegates the verification entirely to the OS:
 *   - iOS:    FaceID / TouchID prompt
 *   - Android: Biometric Prompt (fingerprint / face)
 * Biometric data never leaves the Secure Enclave. The app only learns the
 * boolean result. This is the architecture every serious finance app uses.
 */
export default function BiometricGateScreen() {
  const [cap, setCap] = useState<BiometricCapability | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    biometricService.getCapability().then(setCap);
  }, []);

  async function authenticate() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await biometricService.authenticate('Xác thực để hoàn tất bảo mật BudgetBee');
      if (r === 'success') {
        haptic.success();
        setDone(true);
        setTimeout(() => router.back(), 1200);
      } else if (r === 'lockedOut') {
        Alert.alert('Tạm khoá', 'Quá nhiều lần thử. Vui lòng đợi vài phút và thử lại.');
      } else if (r === 'notAvailable' || r === 'notEnrolled') {
        Alert.alert(
          'Chưa sẵn sàng',
          'Thiết bị chưa có vân tay / khuôn mặt được đăng ký. Vui lòng cài đặt trong Cài đặt thiết bị.',
        );
      } else {
        haptic.warning();
      }
    } finally {
      setBusy(false);
    }
  }

  if (cap === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (cap === 'unavailable') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={28} color={Colors.white} />
          </Pressable>
          <Text style={[Typography.headingM, { color: Colors.white }]}>Xác thực bảo mật</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.center}>
          <View style={styles.lockBg}>
            <Ionicons name="lock-closed" size={48} color={Colors.warning} />
          </View>
          <Text style={[Typography.headingL, { color: Colors.white, marginTop: 24, textAlign: 'center' }]}>
            Thiết bị chưa có khoá
          </Text>
          <Text style={[Typography.bodyM, { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 12, paddingHorizontal: 32 }]}>
            Để dùng tính năng này, hãy bật vân tay / khuôn mặt / mã PIN trong Cài đặt thiết bị, sau đó quay lại đây.
          </Text>
          <PrimaryButton label="Để sau" onPress={() => router.back()} style={{ marginTop: 32, alignSelf: 'stretch', marginHorizontal: 32 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.white} />
        </Pressable>
        <Text style={[Typography.headingM, { color: Colors.white }]}>Xác thực bảo mật</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.center}>
        <View style={[styles.lockBg, done && { backgroundColor: 'rgba(34,197,94,0.18)' }]}>
          <Ionicons
            name={done ? 'checkmark' : cap === 'biometric' ? 'finger-print' : 'lock-closed'}
            size={done ? 72 : 64}
            color={done ? Colors.income : Colors.primary}
          />
        </View>

        <Text style={[Typography.displayM, { color: Colors.white, marginTop: 24, textAlign: 'center' }]}>
          {done ? 'Đã xác thực' : 'Chạm để xác thực'}
        </Text>
        <Text
          style={[
            Typography.bodyM,
            { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 12, paddingHorizontal: 32 },
          ]}
        >
          {done
            ? 'Bảo mật BudgetBee đã được kích hoạt cho phiên này.'
            : cap === 'biometric'
            ? 'BudgetBee dùng vân tay / khuôn mặt do thiết bị của bạn quản lý. Dữ liệu sinh trắc học không bao giờ rời khỏi điện thoại.'
            : 'BudgetBee sẽ dùng mã PIN / hình vẽ của thiết bị để xác thực.'}
        </Text>

        {!done ? (
          <PrimaryButton
            label={busy ? 'Đang xác thực...' : 'Bắt đầu xác thực'}
            onPress={authenticate}
            loading={busy}
            style={{ marginTop: 40, alignSelf: 'stretch', marginHorizontal: 32 }}
          />
        ) : null}
      </View>

      <View style={styles.footer}>
        <Ionicons name="shield-checkmark" size={14} color="rgba(255,255,255,0.5)" />
        <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.5)', marginLeft: 6 }]}>
          Bảo vệ bởi Secure Enclave / Android Keystore
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  lockBg: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(189,232,62,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space.s24,
  },
});
