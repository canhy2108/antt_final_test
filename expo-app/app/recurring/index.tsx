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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { recurringApi, RecurringTransaction } from '@/api/recurring';
import { formatVND, formatShortDate } from '@/utils/format';
import { haptic } from '@/utils/haptics';

const FREQ_LABEL: Record<RecurringTransaction['frequency'], string> = {
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
  monthly: 'Hàng tháng',
  yearly: 'Hàng năm',
};

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export default function RecurringScreen() {
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [nextUpcoming, setNextUpcoming] = useState<RecurringTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await recurringApi.list();
      setItems(res.items);
      setActiveCount(res.active_count);
      setNextUpcoming(res.next_upcoming);
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

  function openNew() {
    haptic.light();
    router.push('/recurring/new');
  }

  async function runNow(r: RecurringTransaction) {
    Alert.alert(
      'Tạo giao dịch ngay?',
      `Tạo "${r.name}" (${formatVND(Number(r.amount))}) ngay bây giờ, lịch sẽ tự dời sang kỳ kế tiếp.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Tạo ngay',
          onPress: async () => {
            setBusyId(r.id);
            try {
              await recurringApi.runNow(r.id);
              haptic.success();
              await load();
            } catch (e: any) {
              Alert.alert('Lỗi', e?.message ?? 'Không tạo được giao dịch');
              haptic.error();
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  async function toggleActive(r: RecurringTransaction, next: boolean) {
    setBusyId(r.id);
    haptic.light();
    try {
      await recurringApi.update(r.id, { is_active: next });
      await load();
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message ?? 'Không cập nhật được');
      haptic.error();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(r: RecurringTransaction) {
    Alert.alert('Xoá giao dịch định kỳ?', `"${r.name}" sẽ bị xoá vĩnh viễn. Các giao dịch đã tạo trước đó không bị ảnh hưởng.`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          setBusyId(r.id);
          try {
            await recurringApi.delete(r.id);
            haptic.success();
            await load();
          } catch (e: any) {
            Alert.alert('Lỗi', e?.message ?? '');
          } finally {
            setBusyId(null);
          }
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
        <Text style={[Typography.headingM, { flex: 1, marginLeft: 12 }]}>Giao dịch định kỳ</Text>
        <Pressable style={styles.addBtn} onPress={openNew}>
          <Ionicons name="add" size={22} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Summary */}
        <View style={styles.summary}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.summaryIcon}>
              <Ionicons name="repeat" size={22} color={Colors.dark} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[Typography.bodyS, { color: 'rgba(28,28,30,0.7)' }]}>Đang hoạt động</Text>
              <Text style={[Typography.headingXL, { color: Colors.dark }]}>{activeCount}</Text>
            </View>
          </View>
          {nextUpcoming?.next_run_at ? (
            <View style={styles.upcomingBox}>
              <Ionicons name="time-outline" size={16} color={Colors.dark} />
              <Text style={[Typography.caption, { color: Colors.dark, marginLeft: 6, flex: 1, fontWeight: '700' }]} numberOfLines={1}>
                Kế tiếp: {nextUpcoming.name} — {formatShortDate(nextUpcoming.next_run_at)}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[Typography.headingM, { marginTop: Space.s24, marginBottom: 12 }]}>Danh sách</Text>

        {loading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : items.length === 0 ? (
          <Empty onAdd={openNew} />
        ) : (
          items.map((r) => (
            <RecurringCard
              key={r.id}
              r={r}
              busy={busyId === r.id}
              onRunNow={() => runNow(r)}
              onToggle={(next) => toggleActive(r, next)}
              onDelete={() => remove(r)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RecurringCard({
  r,
  busy,
  onRunNow,
  onToggle,
  onDelete,
}: {
  r: RecurringTransaction;
  busy: boolean;
  onRunNow: () => void;
  onToggle: (next: boolean) => void;
  onDelete: () => void;
}) {
  const isExpense = r.type === 'expense';
  const days = daysUntil(r.next_run_at);
  const overdue = days !== null && days < 0 && r.is_active;
  const upcoming = days !== null && days >= 0 && days <= 3 && r.is_active;

  return (
    <View style={[styles.card, !r.is_active && { opacity: 0.55 }]}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.cardIcon,
            { backgroundColor: isExpense ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)' },
          ]}
        >
          <Ionicons
            name={isExpense ? 'trending-down' : 'trending-up'}
            size={20}
            color={isExpense ? Colors.expense : Colors.income}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={Typography.headingS} numberOfLines={1}>
            {r.name}
          </Text>
          <Text style={[Typography.bodyS, { marginTop: 2 }]}>
            {FREQ_LABEL[r.frequency]}
            {r.interval > 1 ? ` × ${r.interval}` : ''}
            {' · '}
            <Text style={{ color: isExpense ? Colors.expense : Colors.income, fontWeight: '700' }}>
              {isExpense ? '-' : '+'}
              {formatVND(Number(r.amount))}
            </Text>
          </Text>
        </View>
        <Switch
          value={r.is_active}
          onValueChange={onToggle}
          disabled={busy}
          trackColor={{ true: Colors.primary, false: Colors.grey200 }}
          thumbColor={Colors.white}
        />
      </View>

      {r.next_run_at ? (
        <View style={styles.nextRow}>
          <Ionicons
            name={overdue ? 'alert-circle' : 'calendar-outline'}
            size={14}
            color={overdue ? Colors.expense : upcoming ? Colors.warning : Colors.textSecondary}
          />
          <Text
            style={[
              Typography.caption,
              { marginLeft: 6, color: overdue ? Colors.expense : upcoming ? Colors.warning : Colors.textSecondary, fontWeight: '700' },
            ]}
          >
            {overdue
              ? `Trễ ${Math.abs(days!)} ngày`
              : days === 0
              ? 'Hôm nay'
              : days === 1
              ? 'Ngày mai'
              : days !== null && days > 0
              ? `Còn ${days} ngày`
              : formatShortDate(r.next_run_at)}
          </Text>
          {r.run_count > 0 ? (
            <Text style={[Typography.caption, { marginLeft: 10, color: Colors.textSecondary }]}>
              · đã chạy {r.run_count} lần
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable
          onPress={onRunNow}
          disabled={busy || !r.is_active}
          style={[styles.actionBtn, (!r.is_active || busy) && { opacity: 0.5 }]}
        >
          <Ionicons name="play-circle" size={16} color={Colors.primaryDark} />
          <Text style={[Typography.labelM, { color: Colors.primaryDark, marginLeft: 4 }]}>Tạo ngay</Text>
        </Pressable>
        <Pressable onPress={onDelete} disabled={busy} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={16} color={Colors.expense} />
          <Text style={[Typography.labelM, { color: Colors.expense, marginLeft: 4 }]}>Xoá</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
      <Ionicons name="repeat-outline" size={56} color={Colors.grey400} />
      <Text style={[Typography.headingM, { marginTop: 12 }]}>Chưa có giao dịch định kỳ</Text>
      <Text style={[Typography.bodyS, { marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }]}>
        Lập lịch tự động cho lương, tiền nhà, Netflix, học phí — hệ thống tự tạo giao dịch đúng ngày
      </Text>
      <Pressable onPress={onAdd} style={styles.emptyCta}>
        <Ionicons name="add" size={18} color={Colors.dark} />
        <Text style={[Typography.buttonM, { color: Colors.dark, marginLeft: 6 }]}>Tạo lịch mới</Text>
      </Pressable>
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
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center' },
  summary: { padding: Space.s20, borderRadius: Radius.xl, backgroundColor: Colors.primary, ...Shadow.green },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(28,28,30,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(28,28,30,0.15)',
  },
  card: { padding: 14, marginBottom: 10, borderRadius: Radius.l, backgroundColor: Colors.surface, ...Shadow.s },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: { width: 40, height: 40, borderRadius: Radius.m, alignItems: 'center', justifyContent: 'center' },
  nextRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(189,232,62,0.18)',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(239,68,68,0.10)',
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
});
