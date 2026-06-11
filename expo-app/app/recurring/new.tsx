import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { recurringApi } from '@/api/recurring';
import { accountsApi } from '@/api/accounts';
import { categoriesApi, Category } from '@/api/categories';
import { Account } from '@/types';
import { formatVND } from '@/utils/format';
import { haptic } from '@/utils/haptics';

type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly';
type TxType = 'income' | 'expense';

const FREQS: { key: Freq; label: string; icon: string }[] = [
  { key: 'daily', label: 'Hàng ngày', icon: 'sunny-outline' },
  { key: 'weekly', label: 'Hàng tuần', icon: 'calendar-outline' },
  { key: 'monthly', label: 'Hàng tháng', icon: 'calendar' },
  { key: 'yearly', label: 'Hàng năm', icon: 'trophy-outline' },
];

const PRESETS: { name: string; type: TxType; amount: number; freq: Freq; icon: string }[] = [
  { name: 'Lương tháng', type: 'income', amount: 15_000_000, freq: 'monthly', icon: 'cash-outline' },
  { name: 'Tiền nhà', type: 'expense', amount: 5_000_000, freq: 'monthly', icon: 'home-outline' },
  { name: 'Netflix', type: 'expense', amount: 260_000, freq: 'monthly', icon: 'tv-outline' },
  { name: 'Internet', type: 'expense', amount: 250_000, freq: 'monthly', icon: 'wifi-outline' },
  { name: 'Học phí', type: 'expense', amount: 3_000_000, freq: 'monthly', icon: 'school-outline' },
  { name: 'Khác', type: 'expense', amount: 0, freq: 'monthly', icon: 'add-circle-outline' },
];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function NewRecurringScreen() {
  const [name, setName] = useState('');
  const [type, setType] = useState<TxType>('expense');
  const [amountRaw, setAmountRaw] = useState('');
  const [frequency, setFrequency] = useState<Freq>('monthly');
  const [interval, setIntervalVal] = useState(1);
  const [startsOn, setStartsOn] = useState<Date>(new Date());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = amountRaw ? parseInt(amountRaw, 10) : 0;

  useEffect(() => {
    (async () => {
      try {
        const [accs, cats] = await Promise.all([accountsApi.getAll(), categoriesApi.getAll()]);
        setAccounts(accs);
        setCategories(cats);
        if (accs.length > 0) setAccountId(Number(accs[0].id));
      } catch (e: any) {
        Alert.alert('Lỗi tải dữ liệu', e?.message ?? 'Không tải được tài khoản/danh mục');
      } finally {
        setLoadingRefs(false);
      }
    })();
  }, []);

  // Reset category when type changes — server filters happen on its side
  useEffect(() => {
    setCategoryId(null);
  }, [type]);

  const filteredCategories = useMemo(() => {
    const re = type === 'income' ? /income|thu/i : /expense|chi/i;
    return categories.filter((c) => re.test(c.parent_name ?? ''));
  }, [categories, type]);

  const account = useMemo(() => accounts.find((a) => Number(a.id) === accountId) ?? null, [accounts, accountId]);
  const category = useMemo(() => categories.find((c) => c.id === categoryId) ?? null, [categories, categoryId]);

  function applyPreset(p: typeof PRESETS[number]) {
    haptic.light();
    if (p.name !== 'Khác') setName(p.name);
    setType(p.type);
    if (p.amount > 0) setAmountRaw(String(p.amount));
    setFrequency(p.freq);
  }

  function shiftStart(days: number) {
    haptic.light();
    const d = new Date(startsOn);
    d.setDate(d.getDate() + days);
    setStartsOn(d);
  }

  async function submit() {
    if (!name.trim()) {
      setError('Vui lòng đặt tên');
      haptic.error();
      return;
    }
    if (!amount || amount < 1000) {
      setError('Số tiền phải ≥ 1.000 ₫');
      haptic.error();
      return;
    }
    if (!accountId) {
      setError('Chọn tài khoản nguồn');
      haptic.error();
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await recurringApi.create({
        name: name.trim(),
        type,
        amount,
        from_account_id: accountId,
        category_id: categoryId ?? undefined,
        frequency,
        interval,
        starts_on: ymd(startsOn),
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Không tạo được lịch');
      haptic.error();
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingRefs) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center' }]} edges={['top']}>
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={26} color={Colors.dark} />
          </Pressable>
          <Text style={Typography.headingM}>Lịch mới</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Presets */}
          <Text style={[Typography.labelL, { marginBottom: 10 }]}>Chọn mẫu nhanh</Text>
          <View style={styles.presetGrid}>
            {PRESETS.map((p) => {
              const active = name === p.name;
              return (
                <Pressable
                  key={p.name}
                  onPress={() => applyPreset(p)}
                  style={[styles.preset, active && { borderColor: Colors.primary, borderWidth: 2 }]}
                >
                  <View
                    style={[
                      styles.presetIcon,
                      { backgroundColor: p.type === 'income' ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.12)' },
                    ]}
                  >
                    <Ionicons
                      name={p.icon as any}
                      size={18}
                      color={p.type === 'income' ? Colors.income : Colors.expense}
                    />
                  </View>
                  <Text style={[Typography.caption, { marginTop: 4, fontWeight: '700' }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Type toggle */}
          <Text style={[Typography.labelL, { marginTop: Space.s20, marginBottom: 6 }]}>Loại</Text>
          <View style={styles.typeRow}>
            <TypeChip label="Chi tiêu" active={type === 'expense'} color={Colors.expense} onPress={() => setType('expense')} />
            <TypeChip label="Thu nhập" active={type === 'income'} color={Colors.income} onPress={() => setType('income')} />
          </View>

          {/* Name */}
          <Text style={[Typography.labelL, { marginTop: Space.s20, marginBottom: 6 }]}>Tên giao dịch</Text>
          <TextInput
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (error) setError(null);
            }}
            placeholder="VD: Lương tháng / Tiền nhà / Netflix"
            placeholderTextColor={Colors.grey400}
            style={styles.input}
          />

          {/* Amount */}
          <Text style={[Typography.labelL, { marginTop: Space.s20, marginBottom: 6 }]}>Số tiền</Text>
          <View style={styles.amountWrap}>
            <TextInput
              value={amountRaw}
              onChangeText={(v) => {
                setAmountRaw(v.replace(/\D/g, '').slice(0, 14));
                if (error) setError(null);
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.grey400}
              style={[styles.input, { paddingRight: 60, flex: 1 }]}
            />
            <Text style={styles.amountSuffix}>₫</Text>
          </View>
          {amount > 0 ? (
            <Text style={[Typography.bodyS, { color: Colors.textSecondary, marginTop: 6 }]}>{formatVND(amount)}</Text>
          ) : null}

          {/* Account picker */}
          <Text style={[Typography.labelL, { marginTop: Space.s20, marginBottom: 6 }]}>Tài khoản</Text>
          <Pressable style={styles.picker} onPress={() => setShowAccountPicker((v) => !v)}>
            <Ionicons name="wallet-outline" size={20} color={Colors.dark} />
            <Text style={[Typography.bodyM, { flex: 1, marginLeft: 10 }]}>
              {account?.name ?? 'Chọn tài khoản'}
            </Text>
            <Ionicons name={showAccountPicker ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.grey600} />
          </Pressable>
          {showAccountPicker ? (
            <View style={styles.pickerList}>
              {accounts.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    haptic.light();
                    setAccountId(Number(a.id));
                    setShowAccountPicker(false);
                  }}
                  style={styles.pickerItem}
                >
                  <View style={[styles.dot, { backgroundColor: a.color }]} />
                  <Text style={[Typography.bodyM, { flex: 1, marginLeft: 10 }]}>{a.name}</Text>
                  {Number(a.id) === accountId ? <Ionicons name="checkmark" size={20} color={Colors.primary} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Category picker (optional) */}
          <Text style={[Typography.labelL, { marginTop: Space.s20, marginBottom: 6 }]}>
            Danh mục <Text style={{ color: Colors.textSecondary }}>(tuỳ chọn)</Text>
          </Text>
          <Pressable style={styles.picker} onPress={() => setShowCategoryPicker((v) => !v)}>
            <Ionicons name="pricetag-outline" size={20} color={Colors.dark} />
            <Text style={[Typography.bodyM, { flex: 1, marginLeft: 10 }]}>
              {category?.name ?? '— Không phân loại —'}
            </Text>
            <Ionicons name={showCategoryPicker ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.grey600} />
          </Pressable>
          {showCategoryPicker ? (
            <View style={styles.pickerList}>
              <Pressable
                onPress={() => {
                  haptic.light();
                  setCategoryId(null);
                  setShowCategoryPicker(false);
                }}
                style={styles.pickerItem}
              >
                <Text style={[Typography.bodyM, { flex: 1, color: Colors.textSecondary }]}>— Không phân loại —</Text>
                {categoryId === null ? <Ionicons name="checkmark" size={20} color={Colors.primary} /> : null}
              </Pressable>
              {filteredCategories.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    haptic.light();
                    setCategoryId(c.id);
                    setShowCategoryPicker(false);
                  }}
                  style={styles.pickerItem}
                >
                  <Ionicons name={(c.icon as any) ?? 'pricetag'} size={18} color={c.color ?? Colors.dark} />
                  <Text style={[Typography.bodyM, { flex: 1, marginLeft: 10 }]}>{c.name}</Text>
                  {c.id === categoryId ? <Ionicons name="checkmark" size={20} color={Colors.primary} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Frequency */}
          <Text style={[Typography.labelL, { marginTop: Space.s20, marginBottom: 6 }]}>Tần suất</Text>
          <View style={styles.freqGrid}>
            {FREQS.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => {
                  haptic.light();
                  setFrequency(f.key);
                }}
                style={[styles.freqChip, frequency === f.key && { backgroundColor: Colors.dark, borderColor: Colors.dark }]}
              >
                <Ionicons
                  name={f.icon as any}
                  size={16}
                  color={frequency === f.key ? Colors.primary : Colors.dark}
                />
                <Text
                  style={[
                    Typography.labelM,
                    { color: frequency === f.key ? Colors.primary : Colors.dark, marginLeft: 6 },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Interval stepper */}
          <Text style={[Typography.labelL, { marginTop: Space.s20, marginBottom: 6 }]}>Lặp lại mỗi</Text>
          <View style={styles.intervalRow}>
            <Pressable
              onPress={() => {
                haptic.light();
                setIntervalVal((v) => Math.max(1, v - 1));
              }}
              style={styles.stepBtn}
            >
              <Ionicons name="remove" size={20} color={Colors.dark} />
            </Pressable>
            <View style={styles.intervalValue}>
              <Text style={[Typography.headingM, { color: Colors.dark }]}>
                {interval} {freqUnit(frequency, interval)}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                haptic.light();
                setIntervalVal((v) => Math.min(365, v + 1));
              }}
              style={styles.stepBtn}
            >
              <Ionicons name="add" size={20} color={Colors.dark} />
            </Pressable>
          </View>

          {/* Start date */}
          <Text style={[Typography.labelL, { marginTop: Space.s20, marginBottom: 6 }]}>Ngày bắt đầu</Text>
          <View style={styles.dateRow}>
            <Pressable style={styles.dateChip} onPress={() => shiftStart(-1)}>
              <Ionicons name="chevron-back" size={18} color={Colors.dark} />
            </Pressable>
            <View style={styles.dateValue}>
              <Ionicons name="calendar" size={18} color={Colors.dark} />
              <Text style={[Typography.bodyM, { marginLeft: 8, color: Colors.dark, fontWeight: '700' }]}>
                {startsOn.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </Text>
            </View>
            <Pressable style={styles.dateChip} onPress={() => shiftStart(1)}>
              <Ionicons name="chevron-forward" size={18} color={Colors.dark} />
            </Pressable>
          </View>
          <View style={styles.quickDates}>
            <QuickDate label="Hôm nay" onPress={() => setStartsOn(new Date())} />
            <QuickDate
              label="Ngày 1 tháng sau"
              onPress={() => {
                const d = new Date();
                d.setMonth(d.getMonth() + 1);
                d.setDate(1);
                setStartsOn(d);
              }}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.expense} />
              <Text style={[Typography.caption, { color: Colors.expense, marginLeft: 8, flex: 1 }]}>{error}</Text>
            </View>
          ) : null}

          <PrimaryButton label="Tạo lịch" onPress={submit} loading={submitting} style={{ marginTop: Space.s24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function freqUnit(f: Freq, n: number): string {
  if (f === 'daily') return n === 1 ? 'ngày' : 'ngày';
  if (f === 'weekly') return 'tuần';
  if (f === 'monthly') return 'tháng';
  return 'năm';
}

function TypeChip({ label, active, color, onPress }: { label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={[
        styles.typeChip,
        active && { backgroundColor: color, borderColor: color },
      ]}
    >
      <Text style={[Typography.labelL, { color: active ? Colors.white : color, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

function QuickDate({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={styles.quickDateChip}
    >
      <Text style={[Typography.caption, { color: Colors.dark, fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.pageHorizontal,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    width: '31%',
    padding: 10,
    borderRadius: Radius.m,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  presetIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.dark,
  },
  amountWrap: { position: 'relative', justifyContent: 'center' },
  amountSuffix: { position: 'absolute', right: 16, fontSize: 18, color: Colors.textSecondary, fontWeight: '700' },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerList: {
    marginTop: 6,
    borderRadius: Radius.m,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  freqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freqChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  intervalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalValue: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.m,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.m,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickDates: { flexDirection: 'row', gap: 8, marginTop: 8 },
  quickDateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.grey100,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.s16,
    padding: 12,
    borderRadius: Radius.m,
    backgroundColor: Colors.expense + '15',
  },
});
