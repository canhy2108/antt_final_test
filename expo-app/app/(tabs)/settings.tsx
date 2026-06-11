import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { useAuth } from '@/stores/auth';
import { usePrefs } from '@/stores/prefs';
import { biometricService } from '@/services/biometric';
import { BiometricCapability } from '@/types';
import { secureStorage } from '@/services/secureStorage';
import { haptic } from '@/utils/haptics';
import {
  notificationListener,
  PermissionState,
} from '@/services/notificationListener';
import {
  AutoImportMode,
  getMode as getBankImportMode,
  loadPending,
  setMode as setBankImportMode,
  startListening as startBankListening,
  stopListening as stopBankListening,
} from '@/services/bankAutoImport';

export default function SettingsScreen() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const privacy = usePrefs((s) => s.privacyMode);
  const setPrivacy = usePrefs((s) => s.setPrivacy);
  const bio = usePrefs((s) => s.biometricEnabled);
  const [cap, setCap] = useState<BiometricCapability>('unavailable');
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [fingerEnrolled, setFingerEnrolled] = useState(false);

  // Bank auto-import state. Only meaningful on Android dev build —
  // notificationListener.isAvailable() returns false elsewhere and we
  // hide the section entirely.
  const [bankImportMode, setBankImportModeState] = useState<AutoImportMode>('off');
  const [notifPermission, setNotifPermission] = useState<PermissionState>('unknown');
  const [pendingCount, setPendingCount] = useState(0);
  const bankListenerAvailable = notificationListener.isAvailable();
  const bankUnavailableReason = notificationListener.unavailableReason();

  // Refresh enrollment state whenever the user comes back from /biometric/setup
  useFocusEffect(
    useCallback(() => {
      (async () => {
        setCap(await biometricService.getCapability());
        setFaceEnrolled(await secureStorage.isFaceEnrolled());
        setFingerEnrolled(await secureStorage.isFingerprintEnrolled());

        // Bank auto-import status — only poll on Android. On iOS and on
        // Expo Go these are no-ops returning safe defaults.
        if (bankListenerAvailable) {
          setBankImportModeState(await getBankImportMode());
          setNotifPermission(await notificationListener.getPermissionStatus());
        }
        const pending = await loadPending();
        setPendingCount(pending.length);
      })();
    }, [bankListenerAvailable]),
  );

  /**
   * Toggle mode handler — gates on (1) listener available, (2) OS
   * notification permission granted. If either fails, route the user to
   * the right Settings screen instead of silently failing.
   */
  async function onChangeBankImportMode(next: AutoImportMode) {
    if (!bankListenerAvailable) {
      Alert.alert(
        'Tính năng không khả dụng',
        bankUnavailableReason ?? 'Vui lòng dùng EAS Dev Build trên Android.',
      );
      return;
    }
    if (next !== 'off') {
      const status = await notificationListener.getPermissionStatus();
      setNotifPermission(status);
      if (status !== 'authorized') {
        Alert.alert(
          'Cần quyền đọc thông báo',
          'BudgetBee cần quyền "Notification access" của Android để đọc thông báo ngân hàng. ' +
            'Bấm "Mở Cài đặt" rồi bật toggle "BudgetBee" trong danh sách.',
          [
            { text: 'Huỷ', style: 'cancel' },
            {
              text: 'Mở Cài đặt',
              onPress: async () => {
                await notificationListener.openSettings();
              },
            },
          ],
        );
        return;
      }
    }
    haptic.light();
    await setBankImportMode(next);
    setBankImportModeState(next);
    if (next === 'off') {
      stopBankListening();
    } else {
      startBankListening();
    }
  }

  const bioSubtitle = (() => {
    if (cap === 'unavailable') return 'Thiết bị chưa cài vân tay / khoá màn hình';
    const enrolled: string[] = [];
    if (faceEnrolled) enrolled.push('Khuôn mặt');
    if (fingerEnrolled) enrolled.push('Vân tay');
    if (enrolled.length > 0) return `Đã đăng ký: ${enrolled.join(' + ')}`;
    if (bio) return 'Đang bật — bấm để xem chi tiết';
    return 'Bấm để thiết lập';
  })();

  async function onLogout() {
    Alert.alert('Đăng xuất?', 'Bạn sẽ cần đăng nhập lại lần sau.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  function showAbout() {
    Alert.alert(
      'BudgetBee',
      'Phiên bản 1.0.0\n\nỨng dụng quản lý tài chính cá nhân, phát triển cho thị trường Việt Nam.\n\nMã nguồn: privately hosted',
      [{ text: 'OK' }],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}>
        <Text style={Typography.headingXL}>Cài đặt</Text>

        {/* Profile — read-only display (chỉnh sửa sẽ thêm sau khi BE có endpoint) */}
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={[Typography.headingL, { color: Colors.primary }]}>
              {(user?.name ?? 'B').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[Typography.headingM, { color: Colors.dark }]} numberOfLines={1}>
              {user?.name ?? 'Bạn'}
            </Text>
            <Text style={[Typography.bodyS, { color: Colors.dark }]} numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
          </View>
        </View>

        <Section label="Bảo mật" />
        <Tile
          icon="finger-print-outline"
          iconBg="rgba(189,232,62,0.18)"
          iconColor={Colors.primaryDark}
          title="Sinh trắc học"
          subtitle={bioSubtitle}
          onPress={() => {
            haptic.light();
            router.push('/biometric/setup');
          }}
        />
        <Tile
          icon="eye-off-outline"
          iconBg="rgba(59,130,246,0.12)"
          iconColor={Colors.info}
          title="Chế độ riêng tư"
          subtitle="Ẩn toàn bộ số dư và số tiền"
          right={
            <Switch
              value={privacy}
              trackColor={{ true: Colors.primary, false: Colors.grey200 }}
              thumbColor={Colors.white}
              onValueChange={(v) => {
                haptic.light();
                setPrivacy(v);
              }}
            />
          }
        />
        <Tile
          icon="key-outline"
          iconBg="rgba(245,158,11,0.12)"
          iconColor={Colors.warning}
          title="Đổi mã PIN"
          subtitle="Xác minh OTP qua email (giới hạn 3 lần/ngày)"
          onPress={() => {
            haptic.light();
            router.push('/pin-change');
          }}
        />

        {/* Bank auto-import — chỉ render trên Android dev build. Trên iOS / Expo Go
            ta cho hiển thị 1 dòng "Không hỗ trợ trên iOS / Expo Go" để minh bạch. */}
        {Platform.OS === 'android' || bankListenerAvailable ? (
          <>
            <Section label="Tự động ghi nhận giao dịch" />
            {!bankListenerAvailable ? (
              <View style={[styles.tile, { borderWidth: 1, borderColor: '#F59E0B', backgroundColor: '#FEF3C7' }]}>
                <View style={[styles.tileIcon, { backgroundColor: 'rgba(245,158,11,0.18)' }]}>
                  <Ionicons name="warning" size={22} color={Colors.warning} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={Typography.headingS}>Cần EAS Dev Build</Text>
                  <Text style={Typography.bodyS}>
                    {bankUnavailableReason ??
                      'Expo Go không hỗ trợ. Chạy EAS Build → cài APK dev.'}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Tile
                  icon="notifications-outline"
                  iconBg="rgba(59,130,246,0.12)"
                  iconColor={Colors.info}
                  title={
                    bankImportMode === 'off'
                      ? 'Tự động đọc thông báo'
                      : bankImportMode === 'auto'
                      ? 'Tự lưu khi confidence cao'
                      : 'Hỏi xác nhận trước khi lưu'
                  }
                  subtitle={
                    notifPermission !== 'authorized' && bankImportMode !== 'off'
                      ? '⚠️ Chưa cấp quyền Notification access'
                      : bankImportMode === 'off'
                      ? 'Đang tắt — bấm để bật'
                      : bankImportMode === 'auto'
                      ? 'BudgetBee tự tạo record khi nhận thông báo bank'
                      : 'BudgetBee bóc data → bạn duyệt trước khi lưu'
                  }
                  onPress={() => {
                    haptic.light();
                    Alert.alert(
                      'Chế độ tự động ghi nhận',
                      'Chọn cách BudgetBee xử lý thông báo từ app ngân hàng:',
                      [
                        {
                          text: 'Tắt',
                          style: bankImportMode === 'off' ? 'default' : undefined,
                          onPress: () => onChangeBankImportMode('off'),
                        },
                        {
                          text: 'Hỏi trước khi lưu (khuyến nghị)',
                          onPress: () => onChangeBankImportMode('confirm'),
                        },
                        {
                          text: 'Tự lưu (chỉ confidence cao)',
                          onPress: () => onChangeBankImportMode('auto'),
                        },
                        { text: 'Huỷ', style: 'cancel' },
                      ],
                    );
                  }}
                />
                <Tile
                  icon="receipt-outline"
                  iconBg="rgba(189,232,62,0.18)"
                  iconColor={Colors.primaryDark}
                  title="Giao dịch chờ duyệt"
                  subtitle={
                    pendingCount > 0 ? `${pendingCount} giao dịch đang chờ` : 'Không có gì chờ duyệt'
                  }
                  onPress={() => {
                    haptic.light();
                    router.push('/bank-notifications');
                  }}
                />
              </>
            )}
          </>
        ) : null}

        <Section label="Quản lý tài chính" />
        <Tile
          icon="flag-outline"
          iconBg="rgba(189,232,62,0.18)"
          iconColor={Colors.primaryDark}
          title="Mục tiêu tiết kiệm"
          subtitle="Đặt mục tiêu + theo dõi tiến độ"
          onPress={() => {
            haptic.light();
            router.push('/savings');
          }}
        />
        <Tile
          icon="people-outline"
          iconBg="rgba(245,158,11,0.12)"
          iconColor={Colors.warning}
          title="Vay & Nợ"
          subtitle="Theo dõi tiền cho mượn / đi vay"
          onPress={() => {
            haptic.light();
            router.push('/debts');
          }}
        />
        <Tile
          icon="repeat-outline"
          iconBg="rgba(59,130,246,0.12)"
          iconColor={Colors.info}
          title="Giao dịch định kỳ"
          subtitle="Lương, tiền nhà, Netflix — tự tạo đúng ngày"
          onPress={() => {
            haptic.light();
            router.push('/recurring');
          }}
        />

        <Section label="Bảo mật nâng cao" />
        <Tile
          icon="shield-checkmark-outline"
          iconBg="rgba(34,197,94,0.12)"
          iconColor={Colors.income}
          title="Xác thực 2 bước (2FA)"
          subtitle="Google Authenticator — chống chiếm tài khoản"
          onPress={() => {
            haptic.light();
            router.push('/totp-setup');
          }}
        />
        <Tile
          icon="phone-portrait-outline"
          iconBg="rgba(59,130,246,0.12)"
          iconColor={Colors.info}
          title="Thiết bị & Phiên"
          subtitle="Quản lý đăng nhập trên các thiết bị"
          onPress={() => {
            haptic.light();
            router.push('/devices');
          }}
        />

        <Section label="Ứng dụng" />
        <Tile
          icon="information-circle-outline"
          iconBg={Colors.grey100}
          iconColor={Colors.grey600}
          title="Về BudgetBee"
          subtitle="Phiên bản 1.0.0"
          onPress={showAbout}
        />

        {/* Logout */}
        <View style={{ marginTop: Space.s24 }}>
          <Pressable onPress={onLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color={Colors.expense} />
            <Text style={[Typography.buttonL, { color: Colors.expense, marginLeft: 8 }]}>Đăng xuất</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label }: { label: string }) {
  return <Text style={[Typography.caption, styles.section]}>{label.toUpperCase()}</Text>;
}

function Tile({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !right}
      style={({ pressed }) => [styles.tile, pressed && onPress ? { opacity: 0.7 } : null]}
    >
      <View style={[styles.tileIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={Typography.headingS}>{title}</Text>
        {subtitle ? <Text style={Typography.bodyS}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={20} color={Colors.grey400} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.s24,
    padding: 16,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    ...Shadow.green,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: Space.s24, marginBottom: 8, color: Colors.textSecondary, fontWeight: '700' },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    ...Shadow.s,
  },
  tileIcon: { width: 42, height: 42, borderRadius: Radius.m, alignItems: 'center', justifyContent: 'center' },
  logoutBtn: {
    height: 56,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.expense,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
