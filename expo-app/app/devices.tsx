import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { devicesApi, Device, UserSession } from '@/api/devices';
import { haptic } from '@/utils/haptics';

const PLATFORM_ICON: Record<string, keyof typeof import('@expo/vector-icons').Ionicons.glyphMap> = {
  ios: 'logo-apple',
  android: 'logo-android',
  web: 'globe-outline',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'vừa xong';
  if (diff < 3_600_000) return `${Math.floor(diff / 60000)} phút trước`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
  return `${Math.floor(diff / 86_400_000)} ngày trước`;
}

export default function DevicesScreen() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [currentTokenId, setCurrentTokenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await devicesApi.list();
      setDevices(res.devices.filter((d) => !d.revoked_at));
      setSessions(res.active_sessions);
      setCurrentTokenId(res.current_token_id);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptic.light();
    await load();
    setRefreshing(false);
  }, [load]);

  async function revokeDevice(d: Device) {
    Alert.alert(`Gỡ thiết bị "${d.name ?? d.platform}"?`, 'Tất cả phiên đăng nhập trên thiết bị này sẽ bị huỷ.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Gỡ',
        style: 'destructive',
        onPress: async () => {
          try {
            await devicesApi.revoke(d.id);
            haptic.success();
            await load();
          } catch (e: any) {
            Alert.alert('Lỗi', e?.message ?? '');
          }
        },
      },
    ]);
  }

  async function revokeOthers() {
    Alert.alert(
      'Đăng xuất tất cả thiết bị khác?',
      'Bạn vẫn được giữ đăng nhập trên thiết bị này. Mọi phiên ở thiết bị khác bị huỷ ngay.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            try {
              await devicesApi.revokeOthers();
              haptic.success();
              await load();
              Alert.alert('Xong', 'Đã đăng xuất các thiết bị khác');
            } catch (e: any) {
              Alert.alert('Lỗi', e?.message ?? '');
            }
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
        <Text style={[Typography.headingM, { flex: 1, marginLeft: 12 }]}>Thiết bị & Phiên</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.summaryRow}>
              <SummaryTile label="Thiết bị" value={devices.length} icon="phone-portrait" color={Colors.primary} />
              <SummaryTile label="Phiên đang mở" value={sessions.length} icon="time" color={Colors.info} />
            </View>

            <Text style={[Typography.labelL, { marginTop: Space.s24, marginBottom: 8 }]}>Thiết bị đã đăng ký</Text>
            {devices.length === 0 ? (
              <Text style={[Typography.bodyS, { color: Colors.textSecondary, paddingVertical: 16, textAlign: 'center' }]}>
                Chưa có thiết bị nào được đăng ký
              </Text>
            ) : (
              devices.map((d) => <DeviceCard key={d.id} d={d} onRevoke={() => revokeDevice(d)} />)
            )}

            <Text style={[Typography.labelL, { marginTop: Space.s24, marginBottom: 8 }]}>Phiên đang hoạt động</Text>
            {sessions.length === 0 ? (
              <Text style={[Typography.bodyS, { color: Colors.textSecondary, paddingVertical: 16, textAlign: 'center' }]}>
                Không có phiên nào
              </Text>
            ) : (
              sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  s={s}
                  isCurrent={s.personal_access_token_id === currentTokenId}
                />
              ))
            )}

            {sessions.length > 1 ? (
              <Pressable onPress={revokeOthers} style={styles.dangerBtn}>
                <Ionicons name="log-out-outline" size={20} color={Colors.expense} />
                <Text style={[Typography.buttonM, { color: Colors.expense, marginLeft: 8 }]}>
                  Đăng xuất tất cả thiết bị khác
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryTile({ label, value, icon, color }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <View style={styles.summaryTile}>
      <View style={[styles.summaryIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[Typography.displayM, { color, marginTop: 8 }]}>{value}</Text>
      <Text style={[Typography.caption, { color: Colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function DeviceCard({ d, onRevoke }: { d: Device; onRevoke: () => void }) {
  const icon = PLATFORM_ICON[d.platform ?? ''] ?? 'phone-portrait';
  return (
    <View style={styles.card}>
      <View style={[styles.cardIcon, { backgroundColor: d.is_trusted ? 'rgba(34,197,94,0.15)' : Colors.grey200 }]}>
        <Ionicons name={icon} size={22} color={d.is_trusted ? Colors.income : Colors.dark} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={Typography.headingS} numberOfLines={1}>
            {d.name ?? d.platform ?? 'Thiết bị'}
          </Text>
          {d.is_trusted ? (
            <View style={styles.trustedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={Colors.income} />
              <Text style={[Typography.caption, { color: Colors.income, fontWeight: '700', marginLeft: 2 }]}>Tin cậy</Text>
            </View>
          ) : null}
        </View>
        <Text style={[Typography.bodyS, { marginTop: 2 }]}>
          {d.platform ?? '—'} {d.os_version ? `· ${d.os_version}` : ''}
        </Text>
        <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
          {d.last_location ?? d.last_ip ?? 'Không rõ vị trí'} · {relativeTime(d.last_seen_at)}
        </Text>
      </View>
      <Pressable onPress={onRevoke} hitSlop={12}>
        <Ionicons name="trash-outline" size={20} color={Colors.expense} />
      </Pressable>
    </View>
  );
}

function SessionCard({ s, isCurrent }: { s: UserSession; isCurrent: boolean }) {
  const methodLabel = {
    password: 'Mật khẩu',
    face: 'Khuôn mặt',
    fingerprint: 'Vân tay',
    totp: 'Mã 2FA',
  }[s.auth_method];
  const methodIcon = {
    password: 'key-outline',
    face: 'happy-outline',
    fingerprint: 'finger-print',
    totp: 'shield-checkmark-outline',
  }[s.auth_method] as keyof typeof Ionicons.glyphMap;
  return (
    <View style={[styles.card, isCurrent && { borderColor: Colors.primary, borderWidth: 1.5 }]}>
      <View style={[styles.cardIcon, { backgroundColor: 'rgba(189,232,62,0.18)' }]}>
        <Ionicons name={methodIcon} size={20} color={Colors.primaryDark} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={Typography.headingS}>{methodLabel}</Text>
          {isCurrent ? (
            <View style={[styles.trustedBadge, { backgroundColor: Colors.primary + '30' }]}>
              <Text style={[Typography.caption, { color: Colors.primaryDark, fontWeight: '700' }]}>Hiện tại</Text>
            </View>
          ) : null}
        </View>
        <Text style={[Typography.bodyS, { marginTop: 2 }]}>
          {s.ip_address ?? '—'} · {relativeTime(s.last_active_at)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.pageHorizontal,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryTile: { flex: 1, padding: 14, borderRadius: Radius.l, backgroundColor: Colors.surface, ...Shadow.s },
  summaryIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 10, borderRadius: Radius.l, backgroundColor: Colors.surface, ...Shadow.s },
  cardIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  trustedBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.18)' },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: Space.s24, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.expense },
});
