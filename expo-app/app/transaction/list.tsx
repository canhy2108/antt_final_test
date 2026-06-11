import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList, ActivityIndicator, Alert, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { transactionsApi } from '@/api/transactions';
import { Transaction } from '@/types';
import { formatVND, isSameDay, relativeDateLabel, formatShortDate } from '@/utils/format';
import { haptic } from '@/utils/haptics';

const FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: 'Tất cả' },
  { value: 'expense', label: 'Chi tiêu' },
  { value: 'income', label: 'Thu nhập' },
  { value: 'transfer', label: 'Chuyển khoản' },
];

export default function TransactionListScreen() {
  const [type, setType] = useState<string | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [list, setList] = useState<Transaction[] | null>(null);

  const load = useCallback(async () => {
    setList(null);
    try {
      const r = await transactionsApi.getAll({ type, search });
      setList(r);
    } catch (err: any) {
      Alert.alert('Lỗi tải giao dịch', err?.message ?? 'Lỗi kết nối server');
      setList([]);
    }
  }, [type, search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={Colors.dark} />
        </Pressable>
        {showSearch ? (
          <TextInput
            // The Shadow.s spread inside searchInput widens userSelect to
            // string; cast at the call site to match TextInput's stricter
            // TextStyle. Same logical style, just satisfies the narrower type.
            style={[styles.searchInput as TextStyle, Typography.bodyL]}
            placeholder="Tìm giao dịch..."
            placeholderTextColor={Colors.textDisabled}
            autoFocus
            onChangeText={(v) => setSearch(v.length ? v : null)}
          />
        ) : (
          <Text style={[Typography.headingXL, { flex: 1, marginLeft: 12 }]}>Giao dịch</Text>
        )}
        <Pressable
          onPress={() => {
            haptic.light();
            setShowSearch((v) => !v);
            if (showSearch) setSearch(null);
          }}
          style={styles.circleBtn}
        >
          <Ionicons name={showSearch ? 'close' : 'search'} size={22} color={Colors.dark} />
        </Pressable>
        <View style={{ width: 8 }} />
        <Pressable
          onPress={() => router.push('/transaction/new')}
          style={[styles.circleBtn, { backgroundColor: Colors.dark }]}
        >
          <Ionicons name="add" size={22} color={Colors.white} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = type === f.value;
          return (
            <Pressable
              key={String(f.value)}
              onPress={() => {
                haptic.select();
                setType(f.value);
              }}
              style={[styles.chip, active && { backgroundColor: Colors.dark }]}
            >
              <Text style={[Typography.labelM, { color: active ? Colors.primary : Colors.textPrimary }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {list == null ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : list.length === 0 ? (
        <Empty />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}
          data={list}
          keyExtractor={(t) => t.id}
          renderItem={({ item, index }) => {
            const prev = list[index - 1];
            const showHeader = !prev || !isSameDay(prev.date, item.date);
            return (
              <View>
                {showHeader ? (
                  <Text style={[Typography.labelM, { marginTop: index === 0 ? 0 : 8, marginBottom: 8 }]}>
                    {relativeDateLabel(item.date)}
                  </Text>
                ) : null}
                <Card tx={item} onDelete={async () => {
                  await transactionsApi.delete(item.id);
                  load();
                }} />
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Card({ tx, onDelete }: { tx: Transaction; onDelete: () => void }) {
  const isIncome = tx.type === 'income';
  const color = isIncome ? Colors.income : Colors.expense;
  return (
    <Pressable
      onLongPress={onDelete}
      style={({ pressed }) => [styles.txCard, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.txIcon, { backgroundColor: tx.categoryColor + '20' }]}>
        <Ionicons name="pricetag" size={20} color={tx.categoryColor} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={Typography.headingS} numberOfLines={1}>
          {tx.name || tx.categoryName}
        </Text>
        <Text style={Typography.bodyS}>{tx.categoryName}</Text>
      </View>
      <Text style={[Typography.moneyS, { color }]}>
        {(isIncome ? '+' : '-') + formatVND(tx.amount)}
      </Text>
    </Pressable>
  );
}

function Empty() {
  return (
    <View style={{ alignItems: 'center', marginTop: 80 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.grey100, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="receipt-outline" size={42} color={Colors.grey400} />
      </View>
      <Text style={[Typography.headingM, { marginTop: 16 }]}>Không tìm thấy giao dịch</Text>
      <Text style={[Typography.bodyS, { marginTop: 6, textAlign: 'center', paddingHorizontal: 32 }]}>
        Thử thay đổi bộ lọc hoặc thêm giao dịch mới
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: Space.pageHorizontal },
  searchInput: {
    flex: 1,
    marginHorizontal: 12,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    ...Shadow.s,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.s,
  },
  filterRow: { paddingHorizontal: Space.pageHorizontal, gap: 8, paddingVertical: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    ...Shadow.s,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    ...Shadow.s,
    marginBottom: 8,
  },
  txIcon: { width: 44, height: 44, borderRadius: Radius.m, alignItems: 'center', justifyContent: 'center' },
});
