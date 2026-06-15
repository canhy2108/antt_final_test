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
import { budgetsApi } from '@/api/budgets';
import { Budget } from '@/types';
import { formatVND } from '@/utils/format';
import { haptic } from '@/utils/haptics';

export default function BudgetScreen() {
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await budgetsApi.getAll();
      setBudgets(list);
    } catch {
      setBudgets([]);
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
    router.push('/budget/new');
  }

  function onLongPressBudget(b: Budget) {
    Alert.alert(
      `Xoá "${b.name}"?`,
      'Ngân sách này sẽ bị xoá khỏi tài khoản của bạn.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: async () => {
            try {
              await budgetsApi.delete(b.id);
              haptic.success();
              await load();
            } catch (e: any) {
              Alert.alert('Không xoá được', e?.message ?? '');
            }
          },
        },
      ],
    );
  }

  const totalSpent = (budgets ?? []).reduce((s, b) => s + b.spent, 0);
  const totalLimit = (budgets ?? []).reduce((s, b) => s + b.limit, 0);
  const pct = totalLimit > 0 ? Math.min(1, totalSpent / totalLimit) : 0;
  const over = totalSpent > totalLimit;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Space.s40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={Typography.headingXL}>Ngân sách</Text>
          <Pressable style={styles.addBtn} onPress={openAdd} hitSlop={6}>
            <Ionicons name="add" size={22} color={Colors.primary} />
          </Pressable>
        </View>

        <View style={[styles.overallCard, over && { backgroundColor: Colors.expense }]}>
          <Text style={[Typography.bodyM, { color: over ? 'rgba(255,255,255,0.8)' : 'rgba(28,28,30,0.7)' }]}>
            Tổng ngân sách tháng
          </Text>
          <View style={styles.pillBar}>
            <View
              style={[styles.pillFill, { width: `${pct * 100}%`, backgroundColor: over ? Colors.white : Colors.dark }]}
            />
          </View>
          <Text style={[Typography.moneyXL, { color: over ? Colors.white : Colors.dark, marginTop: 12 }]}>
            {formatVND(totalSpent)}
          </Text>
          <Text style={[Typography.bodyS, { color: over ? 'rgba(255,255,255,0.8)' : 'rgba(28,28,30,0.7)' }]}>
            / {formatVND(totalLimit)} ({Math.round(pct * 100)}%)
          </Text>
        </View>

        <Text style={[Typography.headingM, styles.section]}>Theo danh mục</Text>

        <View style={{ paddingHorizontal: Space.pageHorizontal }}>
          {budgets == null ? (
            <ActivityIndicator color={Colors.primary} />
          ) : budgets.length === 0 ? (
            <Empty onAdd={openAdd} />
          ) : (
            budgets.map((b) => <BCard key={b.id} b={b} onLongPress={() => onLongPressBudget(b)} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BCard({ b, onLongPress }: { b: Budget; onLongPress: () => void }) {
  const pct = b.limit > 0 ? Math.min(1, b.spent / b.limit) : 0;
  const isOver = b.spent > b.limit;
  const near = pct >= 0.8 && !isOver;
  const color = isOver ? Colors.expense : near ? Colors.warning : b.color;

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={400}
      style={[styles.budgetCard, isOver && { borderColor: Colors.expense + '50', borderWidth: 1.5 }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[styles.bIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={(b.icon as any) ?? 'wallet'} size={20} color={color} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={Typography.headingS}>{b.name}</Text>
          <Text style={Typography.bodyS}>
            {formatVND(b.spent)} / {formatVND(b.limit)}
          </Text>
        </View>
        <Text style={[Typography.headingM, { color }]}>{Math.round(pct * 100)}%</Text>
      </View>

      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </Pressable>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: Colors.grey100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="pie-chart-outline" size={40} color={Colors.grey400} />
      </View>
      <Text style={[Typography.headingM, { marginTop: 12 }]}>Chưa có ngân sách</Text>
      <Text style={[Typography.bodyS, { marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }]}>
        Thêm ngân sách cho danh mục bạn muốn theo dõi chi tiêu
      </Text>
      <Pressable onPress={onAdd} style={styles.emptyCta}>
        <Ionicons name="add" size={18} color={Colors.dark} />
        <Text style={[Typography.buttonM, { color: Colors.dark, marginLeft: 6 }]}>Thêm ngân sách</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Space.pageHorizontal },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center' },
  overallCard: {
    marginHorizontal: Space.pageHorizontal,
    padding: Space.s20,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    ...Shadow.green,
  },
  pillBar: {
    height: 10,
    backgroundColor: 'rgba(28,28,30,0.2)',
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginTop: 12,
  },
  pillFill: { height: '100%', borderRadius: Radius.full },
  section: { paddingHorizontal: Space.pageHorizontal, marginTop: Space.s24, marginBottom: Space.s12 },
  budgetCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    ...Shadow.s,
  },
  bIcon: { width: 42, height: 42, borderRadius: Radius.m, alignItems: 'center', justifyContent: 'center' },
  barBg: { height: 8, backgroundColor: Colors.grey200, borderRadius: Radius.full, overflow: 'hidden', marginTop: 12 },
  barFill: { height: '100%', borderRadius: Radius.full },
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
