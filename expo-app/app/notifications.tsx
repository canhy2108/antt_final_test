import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { notificationsApi, BeNotification, NotificationType } from '@/api/notifications';
import { haptic } from '@/utils/haptics';

const ICON_BY_TYPE: Record<NotificationType, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  welcome: { name: 'hand-left-outline', color: Colors.primary },
  budget_exceeded: { name: 'warning-outline', color: Colors.expense },
  low_balance: { name: 'wallet-outline', color: Colors.warning },
  large_transaction: { name: 'trending-up-outline', color: Colors.info },
  security_alert: { name: 'shield-checkmark-outline', color: Colors.expense },
  bio_enrolled: { name: 'finger-print-outline', color: Colors.primary },
  system: { name: 'information-circle-outline', color: Colors.textSecondary },
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'vừa xong';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<BeNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await notificationsApi.list({ limit: 50 });
      setItems(res.items);
      setUnreadCount(res.unread_count);
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

  async function markRead(n: BeNotification) {
    if (n.read_at) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationsApi.markRead(n.id);
    } catch {
      // optimistic — silently swallow
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    haptic.medium();
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await notificationsApi.markAllRead();
    } catch {}
  }

  async function deleteOne(n: BeNotification) {
    Alert.alert('Xoá thông báo?', n.title, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          setItems((prev) => prev.filter((x) => x.id !== n.id));
          try {
            await notificationsApi.delete(n.id);
          } catch {}
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={Colors.dark} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={Typography.headingM}>Thông báo</Text>
          {unreadCount > 0 ? (
            <Text style={[Typography.caption, { color: Colors.textSecondary }]}>{unreadCount} chưa đọc</Text>
          ) : null}
        </View>
        {unreadCount > 0 ? (
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text style={[Typography.labelM, { color: Colors.primary, fontWeight: '700' }]}>Đọc hết</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={56} color={Colors.grey400} />
            <Text style={[Typography.headingM, { marginTop: 12 }]}>Chưa có thông báo nào</Text>
            <Text style={[Typography.bodyS, { color: Colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
              Các thông báo từ BudgetBee sẽ hiện ở đây
            </Text>
          </View>
        ) : (
          items.map((n) => (
            <NotifTile key={n.id} n={n} onTap={() => markRead(n)} onLongPress={() => deleteOne(n)} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NotifTile({
  n,
  onTap,
  onLongPress,
}: {
  n: BeNotification;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const icon = ICON_BY_TYPE[n.type] ?? ICON_BY_TYPE.system;
  const unread = !n.read_at;
  return (
    <Pressable
      onPress={onTap}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={[styles.tile, unread && { backgroundColor: 'rgba(189,232,62,0.10)', borderColor: Colors.primary, borderWidth: 1.5 }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: icon.color + '20' }]}>
        <Ionicons name={icon.name} size={22} color={icon.color} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[Typography.headingS, { flex: 1 }]} numberOfLines={1}>
            {n.title}
          </Text>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        {n.body ? (
          <Text style={[Typography.bodyS, { marginTop: 2 }]} numberOfLines={2}>
            {n.body}
          </Text>
        ) : null}
        <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 4 }]}>
          {relativeTime(n.created_at)}
        </Text>
      </View>
    </Pressable>
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
  tile: {
    flexDirection: 'row',
    padding: 14,
    marginBottom: 10,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    ...Shadow.s,
  },
  tileIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
});
