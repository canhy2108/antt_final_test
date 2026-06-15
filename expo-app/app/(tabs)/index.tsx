import { useCallback, useState } from 'react';
import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { useAuth } from '@/stores/auth';
import { usePrefs } from '@/stores/prefs';
import { transactionsApi } from '@/api/transactions';
import { accountsApi } from '@/api/accounts';
import { notificationsApi } from '@/api/notifications';
import { MonthStats, Account, Transaction } from '@/types';
import { formatVND, formatCompactVND, formatShortDate } from '@/utils/format';
import { haptic } from '@/utils/haptics';

export default function DashboardScreen() {
  const user = useAuth((s) => s.user);
  const privacy = usePrefs((s) => s.privacyMode);
  const setPrivacy = usePrefs((s) => s.setPrivacy);

  const [stats, setStats] = useState<MonthStats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const load = useCallback(async () => {
    // Wrap in try/catch so a 401 (which the axios interceptor handles by
    // redirecting to /login) doesn't bubble up as an Uncaught promise
    // rejection. Each sub-call also has its own fallback in the API layer.
    try {
      const [s, a, r, nc] = await Promise.all([
        transactionsApi.getMonthStats(),
        accountsApi.getAll(),
        transactionsApi.getRecent(5),
        notificationsApi.unreadCount(),
      ]);
      setStats(s);
      setAccounts(a);
      setRecent(r);
      setUnreadNotifCount(nc);
    } catch (err: any) {
      // Surface network/backend errors to the user
      Alert.alert('Lỗi tải dashboard', err?.message ?? 'Lỗi kết nối server');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // "Tổng số dư" hiển thị tổng SỐ DƯ HIỆN TẠI của tất cả tài khoản
  // (không phải net của period). BE giờ trả `balance` chính xác, nhưng để
  // chắc chắn fresh sau khi vừa thêm account, fallback compute từ accounts.
  const totalBalance =
    accounts.length > 0 ? accounts.reduce((s, a) => s + a.balance, 0) : stats?.balance ?? 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng,';
    if (h < 17) return 'Chào buổi chiều,';
    return 'Chào buổi tối,';
  })();

  const firstName = (user?.name ?? 'Bạn').split(' ').slice(-1)[0];
  const mask = (val: string) => (privacy ? '••••••' : val);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.bodyM, { color: Colors.textSecondary }]}>{greeting}</Text>
            <Text style={Typography.headingL}>{firstName} 👋</Text>
          </View>
          <IconBtn
            icon={privacy ? 'eye-off' : 'eye'}
            active={privacy}
            onPress={() => {
              haptic.light();
              setPrivacy(!privacy);
            }}
          />
          <View style={{ width: 8 }} />
          <IconBtn
            icon="notifications-outline"
            badge={unreadNotifCount > 0 ? unreadNotifCount : undefined}
            onPress={() => {
              haptic.light();
              router.push('/notifications');
            }}
          />
        </View>

        <View style={styles.balanceCard}>
          <Text style={[Typography.bodyM, { color: 'rgba(28,28,30,0.7)' }]}>Tổng số dư</Text>
          <Text style={[Typography.moneyXL, { color: Colors.dark, marginTop: 4 }]}>
            {stats == null && accounts.length === 0 ? '...' : mask(formatVND(totalBalance))}
          </Text>
          {/* The "+8.2% tháng này" pill was hard-coded — removed until BE
              exposes a real month-over-month comparison endpoint. */}
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Thu nhập" amount={stats?.income} positive color={Colors.income} mask={mask} icon="arrow-down" />
          <StatCard label="Chi tiêu" amount={stats?.expense} color={Colors.expense} mask={mask} icon="arrow-up" />
        </View>

        <SectionHeader title="Tài khoản" onSeeAll={() => router.push('/(tabs)/accounts')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Space.pageHorizontal, gap: 12 }}>
          {accounts.length === 0 ? (
            <EmptyInline icon="wallet-outline" label="Chưa có tài khoản" cta="Thêm" onCta={() => router.push('/account/new')} />
          ) : (
            accounts.map((acc) => <AccountCard key={acc.id} acc={acc} mask={mask} />)
          )}
        </ScrollView>

        <SectionHeader title="Gần đây" onSeeAll={() => router.push('/transaction/list')} />
        <View style={{ paddingHorizontal: Space.pageHorizontal }}>
          {recent.length === 0 ? (
            <EmptyInline icon="receipt-outline" label="Chưa có giao dịch nào" cta="Tạo giao dịch" onCta={() => router.push('/transaction/new')} />
          ) : (
            recent.map((tx) => <TxItem key={tx.id} tx={tx} mask={mask} />)
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function IconBtn({
  icon,
  active,
  onPress,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress?: () => void;
  /** Small numeric badge in the top-right corner (notifications count). */
  badge?: number;
}) {
  // Cap badge display at 99+ to keep the dot compact.
  const badgeText = badge && badge > 99 ? '99+' : badge ? String(badge) : null;
  return (
    <Pressable onPress={onPress} style={{ width: 44, height: 44 }}>
      <View
        style={[
          styles.iconBtn,
          active && { backgroundColor: 'rgba(189,232,62,0.18)' },
        ]}
      >
        <Ionicons name={icon} size={22} color={active ? Colors.primaryDark : Colors.dark} />
        {badgeText ? (
          <View
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              paddingHorizontal: 4,
              borderRadius: 8,
              backgroundColor: Colors.expense,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: Colors.white, fontSize: 10, fontWeight: '700' }}>{badgeText}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function EmptyInline({
  icon,
  label,
  cta,
  onCta,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  cta: string;
  onCta: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: Radius.l,
        backgroundColor: Colors.surface,
        marginHorizontal: Space.pageHorizontal,
        marginVertical: 4,
        ...Shadow.s,
        flex: 1,
      }}
    >
      <Ionicons name={icon} size={24} color={Colors.grey400} />
      <Text style={[Typography.bodyM, { flex: 1, marginLeft: 12, color: Colors.textSecondary }]}>{label}</Text>
      <Pressable
        onPress={onCta}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: Radius.full,
          backgroundColor: Colors.primary,
        }}
      >
        <Text style={[Typography.labelM, { color: Colors.dark, fontWeight: '700' }]}>{cta}</Text>
      </Pressable>
    </View>
  );
}

function StatCard({
  label,
  amount,
  positive,
  color,
  icon,
  mask,
}: {
  label: string;
  amount?: number;
  positive?: boolean;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  mask: (v: string) => string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[Typography.bodyS, { marginTop: 12 }]}>{label}</Text>
      <Text style={[Typography.moneyS, { color, marginTop: 2 }]} numberOfLines={1}>
        {amount == null ? '...' : mask((positive ? '+' : '') + formatCompactVND(amount) + ' đ')}
      </Text>
    </View>
  );
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={Typography.headingM}>{title}</Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll}>
          <Text style={[Typography.labelM, { color: Colors.primary, fontWeight: '700' }]}>Xem tất cả</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AccountCard({ acc, mask }: { acc: Account; mask: (v: string) => string }) {
  return (
    <View style={[styles.accCard, { backgroundColor: acc.color }]}>
      <View style={styles.accCardTop}>
        <View style={styles.accIcon}>
          <Ionicons name="wallet" size={16} color={Colors.white} />
        </View>
        <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.6)" />
      </View>
      <View style={{ flex: 1 }} />
      <Text style={[Typography.labelL, { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
        {acc.name}
      </Text>
      <Text style={[Typography.moneyM, { color: Colors.white, marginTop: 2 }]} numberOfLines={1}>
        {mask(formatCompactVND(acc.balance) + ' ' + acc.currencySymbol)}
      </Text>
    </View>
  );
}

function TxItem({ tx, mask }: { tx: Transaction; mask: (v: string) => string }) {
  const positive = tx.type === 'income';
  return (
    <View style={styles.txItem}>
      <View style={[styles.txIcon, { backgroundColor: tx.categoryColor + '20' }]}>
        <Ionicons name="pricetag" size={18} color={tx.categoryColor} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={Typography.headingS} numberOfLines={1}>
          {tx.name || tx.categoryName}
        </Text>
        <Text style={Typography.bodyS}>
          {tx.categoryName} • {formatShortDate(tx.date)}
        </Text>
      </View>
      <Text style={[Typography.moneyS, { color: positive ? Colors.income : Colors.expense }]}>
        {mask((positive ? '+' : '-') + formatCompactVND(tx.amount) + ' đ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingTop: Space.s20, paddingBottom: Space.s40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.pageHorizontal },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.s,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.expense,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: {
    marginHorizontal: Space.pageHorizontal,
    marginTop: Space.s24,
    padding: Space.s20,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    ...Shadow.green,
  },
  pill: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28,28,30,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statsRow: { flexDirection: 'row', marginTop: Space.s16, paddingHorizontal: Space.pageHorizontal, gap: 12 },
  statCard: { flex: 1, padding: 16, borderRadius: Radius.l, backgroundColor: Colors.surface, ...Shadow.s },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.pageHorizontal,
    marginTop: Space.s24,
    marginBottom: Space.s12,
  },
  accCard: { width: 170, height: 130, padding: 16, borderRadius: Radius.l, ...Shadow.m },
  accCardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  accIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.25)' },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 12,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    ...Shadow.s,
  },
  txIcon: { width: 44, height: 44, borderRadius: Radius.m, alignItems: 'center', justifyContent: 'center' },
});
