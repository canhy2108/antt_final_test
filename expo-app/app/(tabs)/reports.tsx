import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, PieChart } from 'react-native-gifted-charts';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { transactionsApi } from '@/api/transactions';
import { accountsApi } from '@/api/accounts';
import { categoriesApi } from '@/api/categories';
import { formatVND, formatCompactVND } from '@/utils/format';
import { Account, MonthStats, Transaction } from '@/types';
import { haptic } from '@/utils/haptics';

type Range = 'Tuần' | 'Tháng' | 'Quý' | 'Năm';
const RANGES: Range[] = ['Tuần', 'Tháng', 'Quý', 'Năm'];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Compute [from, to] for a range, ending today. */
function rangeBounds(range: Range): { from: Date; to: Date; bucketDays: number; bucketCount: number } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  let bucketDays = 1;
  let bucketCount = 7;
  switch (range) {
    case 'Tuần':
      bucketDays = 1;
      bucketCount = 7;
      break;
    case 'Tháng':
      bucketDays = 3;
      bucketCount = 10; // 30 days / 3-day buckets
      break;
    case 'Quý':
      bucketDays = 9;
      bucketCount = 10; // 90 days / 9-day buckets
      break;
    case 'Năm':
      bucketDays = 30;
      bucketCount = 12;
      break;
  }
  const from = new Date(to);
  from.setDate(from.getDate() - bucketDays * bucketCount);
  from.setHours(0, 0, 0, 0);
  return { from, to, bucketDays, bucketCount };
}

interface TrendPoint {
  value: number;
  label?: string;
}

/** Bucket transactions into a time-series for the chart. */
function buildTrend(transactions: Transaction[], range: Range): TrendPoint[] {
  const { from, bucketDays, bucketCount } = rangeBounds(range);
  const buckets = new Array<number>(bucketCount).fill(0);
  // Running balance: start at 0, add income, subtract expense per bucket
  for (const tx of transactions) {
    const d = new Date(tx.date);
    const diff = Math.floor((d.getTime() - from.getTime()) / 86400000);
    const idx = Math.floor(diff / bucketDays);
    if (idx < 0 || idx >= bucketCount) continue;
    const signed = tx.type === 'income' ? tx.amount : -tx.amount;
    buckets[idx] += signed;
  }
  // Cumulative (running balance)
  let acc = 0;
  return buckets.map((b, i) => {
    acc += b;
    const labelIdx = i === 0 || i === bucketCount - 1 || i === Math.floor(bucketCount / 2);
    let label: string | undefined;
    if (labelIdx) {
      const d = new Date(from);
      d.setDate(d.getDate() + bucketDays * (i + 1));
      label = range === 'Năm' ? `T${d.getMonth() + 1}` : `${d.getDate()}/${d.getMonth() + 1}`;
    }
    return { value: acc, label };
  });
}

interface Slice {
  id: string;
  name: string;
  color: string;
  value: number;
}

/** Aggregate expense transactions by category for the donut chart. */
function buildBreakdown(transactions: Transaction[]): Slice[] {
  const byCat = new Map<string, Slice>();
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const key = tx.categoryId || 'misc';
    const existing = byCat.get(key);
    if (existing) {
      existing.value += tx.amount;
    } else {
      byCat.set(key, {
        id: key,
        name: tx.categoryName,
        color: tx.categoryColor,
        value: tx.amount,
      });
    }
  }
  return Array.from(byCat.values()).sort((a, b) => b.value - a.value);
}

export default function ReportsScreen() {
  const [range, setRange] = useState<Range>('Tháng');
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (r: Range) => {
      const { from, to } = rangeBounds(r);
      try {
        const [s, list, accs] = await Promise.all([
          transactionsApi.getMonthStats(ymd(from), ymd(to)),
          transactionsApi.getAll({ from: ymd(from), to: ymd(to) }),
          accountsApi.getAll(),
        ]);
        setStats(s);
        setTxs(list);
        setAccounts(accs);
        // Warm category cache so colors are fresh next render
        categoriesApi.getAll().catch(() => {});
      } catch (err: any) {
        Alert.alert('Lỗi tải báo cáo', err?.message ?? 'Lỗi kết nối server');
      }
    },
    [],
  );

  useEffect(() => {
    setLoading(true);
    load(range).finally(() => setLoading(false));
  }, [range, load]);

  const trend = useMemo(() => buildTrend(txs, range), [txs, range]);
  const breakdown = useMemo(() => buildBreakdown(txs), [txs]);
  const totalBreakdown = breakdown.reduce((s, c) => s + c.value, 0);

  async function onRefresh() {
    setRefreshing(true);
    haptic.light();
    await load(range);
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Space.s40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={Typography.headingXL}>Báo cáo</Text>
          <View style={styles.tabSwitch}>
            {RANGES.map((r) => (
              <Pressable
                key={r}
                onPress={() => {
                  haptic.select();
                  setRange(r);
                }}
                style={[styles.tabBtn, range === r && { backgroundColor: Colors.primary }]}
              >
                <Text style={[Typography.labelM, { color: range === r ? Colors.dark : Colors.white }]}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.summary}>
          <Text style={[Typography.bodyM, { color: 'rgba(28,28,30,0.7)' }]}>Số dư cuối kỳ</Text>
          <Text style={[Typography.moneyXL, { color: Colors.dark, marginTop: 4 }]}>
            {loading && accounts.length === 0
              ? '...'
              : formatVND(
                  accounts.length > 0
                    ? accounts.reduce((s, a) => s + a.balance, 0)
                    : stats?.balance ?? 0,
                )}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <SmallStat label="Thu nhập" value={stats?.income ?? 0} color={Colors.income} icon="arrow-down" />
            <SmallStat label="Chi tiêu" value={stats?.expense ?? 0} color={Colors.expense} icon="arrow-up" />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={Typography.headingM}>Xu hướng số dư</Text>
            <Text style={[Typography.caption, { color: Colors.textSecondary, fontWeight: '700' }]}>
              {range}
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 60 }} />
          ) : trend.every((p) => p.value === 0) ? (
            <EmptyChart message="Chưa có giao dịch trong khoảng này" />
          ) : (
            <LineChart
              data={trend}
              color={Colors.primary}
              thickness={3}
              curved
              startFillColor={Colors.primary}
              endFillColor={Colors.primary + '00'}
              startOpacity={0.4}
              endOpacity={0}
              areaChart
              yAxisColor="transparent"
              xAxisColor="transparent"
              yAxisTextStyle={Typography.caption}
              xAxisLabelTextStyle={Typography.caption}
              initialSpacing={10}
              adjustToWidth
              noOfSections={3}
              formatYLabel={(v) => formatCompactVND(Number(v))}
              hideRules
              isAnimated
            />
          )}
        </View>

        <View style={styles.card}>
          <Text style={Typography.headingM}>Chi tiêu theo danh mục</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 40 }} />
          ) : breakdown.length === 0 ? (
            <EmptyChart message="Chưa có giao dịch chi tiêu" />
          ) : (
            <>
              <View style={{ alignItems: 'center', marginTop: 16 }}>
                <PieChart
                  data={breakdown.map((c) => ({ value: c.value, color: c.color, text: '' }))}
                  donut
                  radius={90}
                  innerRadius={60}
                  centerLabelComponent={() => (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={[Typography.bodyS]}>Tổng</Text>
                      <Text style={[Typography.headingM]}>{formatCompactVND(totalBreakdown)}</Text>
                    </View>
                  )}
                />
              </View>
              <View style={{ marginTop: 16 }}>
                {breakdown.slice(0, 8).map((c) => (
                  <View key={c.id} style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: c.color }]} />
                    <Text style={[Typography.bodyM, { flex: 1, marginLeft: 8 }]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={[Typography.labelL, { color: c.color }]}>
                      {Math.round((c.value / totalBreakdown) * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SmallStat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.smallStat}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name={icon} size={14} color={color} />
        <Text style={[Typography.bodyS, { marginLeft: 6 }]}>{label}</Text>
      </View>
      <Text style={[Typography.moneyS, { color, marginTop: 4 }]}>{formatVND(value)}</Text>
    </View>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <Ionicons name="analytics-outline" size={48} color={Colors.grey400} />
      <Text style={[Typography.bodyS, { marginTop: 8, color: Colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Space.pageHorizontal },
  tabSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.dark,
    borderRadius: Radius.full,
    padding: 4,
    marginTop: 12,
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.full },
  summary: {
    marginHorizontal: Space.pageHorizontal,
    padding: Space.s20,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    ...Shadow.green,
  },
  smallStat: { flex: 1, padding: 12, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: Radius.m },
  card: {
    marginHorizontal: Space.pageHorizontal,
    marginTop: Space.s16,
    padding: Space.s20,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    ...Shadow.s,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
