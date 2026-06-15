import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { savingsGoalsApi, SavingsGoal } from '@/api/savingsGoals';
import { formatVND, formatCompactVND } from '@/utils/format';
import { haptic } from '@/utils/haptics';

export default function SavingsGoalsScreen() {
  const [items, setItems] = useState<SavingsGoal[]>([]);
  const [totals, setTotals] = useState({ active_count: 0, total_target: 0, total_saved: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await savingsGoalsApi.list();
      setItems(res.items);
      setTotals({
        active_count: res.active_count,
        total_target: res.total_target,
        total_saved: res.total_saved,
      });
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

  function openAdd() {
    haptic.light();
    router.push('/savings/new');
  }

  function openGoal(id: number) {
    haptic.light();
    router.push(`/savings/${id}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={Colors.dark} />
        </Pressable>
        <Text style={[Typography.headingM, { flex: 1, marginLeft: 12 }]}>Mục tiêu tiết kiệm</Text>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={22} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Summary card */}
        <View style={styles.summary}>
          <Text style={[Typography.bodyM, { color: 'rgba(28,28,30,0.7)' }]}>Tổng đã tiết kiệm</Text>
          <Text style={[Typography.moneyXL, { color: Colors.dark, marginTop: 4 }]}>
            {formatVND(totals.total_saved)}
          </Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryChip}>
              <Text style={[Typography.caption, { color: Colors.dark, fontWeight: '700' }]}>
                / {formatCompactVND(totals.total_target)} mục tiêu
              </Text>
            </View>
            <View style={styles.summaryChip}>
              <Text style={[Typography.caption, { color: Colors.dark, fontWeight: '700' }]}>
                {totals.active_count} mục tiêu đang chạy
              </Text>
            </View>
          </View>
        </View>

        <Text style={[Typography.headingM, { marginTop: Space.s24, marginBottom: 12 }]}>Danh sách</Text>

        {loading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : items.length === 0 ? (
          <Empty onAdd={openAdd} />
        ) : (
          items.map((g) => <GoalCard key={g.id} g={g} onPress={() => openGoal(g.id)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function GoalCard({ g, onPress }: { g: SavingsGoal; onPress: () => void }) {
  const completed = g.status === 'completed';
  const percent = g.progress_percent ?? 0;
  return (
    <Pressable onPress={onPress} style={[styles.card, completed && { borderColor: Colors.income, borderWidth: 1.5 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: (g.color ?? Colors.primary) + '30' }]}>
          <Ionicons name={(g.icon as any) ?? 'flag'} size={22} color={g.color ?? Colors.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={Typography.headingS} numberOfLines={1}>
            {g.name}
          </Text>
          <Text style={[Typography.bodyS, { marginTop: 2 }]}>
            {formatCompactVND(Number(g.current_amount))} / {formatCompactVND(Number(g.target_amount))}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[Typography.headingM, { color: completed ? Colors.income : Colors.primary }]}>
            {Math.round(percent)}%
          </Text>
          {g.days_left !== null ? (
            <Text style={[Typography.caption, { color: g.days_left < 30 ? Colors.warning : Colors.textSecondary }]}>
              {g.days_left > 0 ? `Còn ${g.days_left} ngày` : 'Đã đến hạn'}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.barBg}>
        <View
          style={[styles.barFill, { width: `${Math.min(100, percent)}%`, backgroundColor: completed ? Colors.income : Colors.primary }]}
        />
      </View>

      {/* Milestone indicators */}
      <View style={styles.milestoneRow}>
        {[25, 50, 75, 100].map((m) => {
          const reached = (g.milestones_reached ?? []).includes(m);
          return (
            <View key={m} style={[styles.milestone, reached && { backgroundColor: Colors.income }]}>
              <Text style={[Typography.caption, { color: reached ? Colors.white : Colors.textSecondary, fontWeight: '700' }]}>
                {m}%
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
      <Ionicons name="flag-outline" size={56} color={Colors.grey400} />
      <Text style={[Typography.headingM, { marginTop: 12 }]}>Chưa có mục tiêu nào</Text>
      <Text style={[Typography.bodyS, { marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }]}>
        Đặt mục tiêu tiết kiệm — vd mua MacBook, du lịch, mua nhà — và theo dõi tiến độ
      </Text>
      <Pressable onPress={onAdd} style={styles.emptyCta}>
        <Ionicons name="add" size={18} color={Colors.dark} />
        <Text style={[Typography.buttonM, { color: Colors.dark, marginLeft: 6 }]}>Tạo mục tiêu</Text>
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
  summary: {
    padding: Space.s20,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    ...Shadow.green,
  },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  summaryChip: {
    backgroundColor: 'rgba(28,28,30,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  card: { padding: 14, marginBottom: 12, borderRadius: Radius.l, backgroundColor: Colors.surface, ...Shadow.s },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: { width: 44, height: 44, borderRadius: Radius.m, alignItems: 'center', justifyContent: 'center' },
  barBg: { height: 8, backgroundColor: Colors.grey200, borderRadius: Radius.full, overflow: 'hidden', marginTop: 12 },
  barFill: { height: '100%', borderRadius: Radius.full },
  milestoneRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  milestone: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 4,
    borderRadius: Radius.s,
    backgroundColor: Colors.grey200,
    alignItems: 'center',
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
