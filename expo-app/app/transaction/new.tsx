import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { transactionsApi } from '@/api/transactions';
import { accountsApi } from '@/api/accounts';
import { categoriesApi, Category } from '@/api/categories';
import { Account, TransactionType } from '@/types';
import { haptic } from '@/utils/haptics';

// Support transfer tab — UI and payload already support `to_account_id`.
const TABS: { type: TransactionType; label: string; color: string }[] = [
  { type: 'expense', label: 'Chi tiêu', color: Colors.expense },
  { type: 'income', label: 'Thu nhập', color: Colors.income },
  { type: 'transfer', label: 'Chuyển', color: Colors.info },
];

const KEYS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['000', '0', 'DEL'],
];

/** Format YYYY-MM-DD for sending to backend (Laravel `date` rule). */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Pretty Vietnamese date label like "Hôm nay" / "Hôm qua" / "21/06/2026". */
function dateLabel(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays === -1) return 'Ngày mai';
  return d.toLocaleDateString('vi-VN');
}

export default function NewTransactionScreen() {
  const [tab, setTab] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('0');
  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date>(new Date());

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  const [fromAccount, setFromAccount] = useState<Account | null>(null);
  const [toAccount, setToAccount] = useState<Account | null>(null);
  const [category, setCategory] = useState<Category | null>(null);

  const [saving, setSaving] = useState(false);

  const color = TABS.find((t) => t.type === tab)!.color;

  useEffect(() => {
    (async () => {
      try {
        const [accs, cats] = await Promise.all([accountsApi.getAll(), categoriesApi.getAll()]);
        setAccounts(accs);
        setCategories(cats);
        if (accs.length > 0) setFromAccount(accs[0]);
        if (accs.length > 1) setToAccount(accs[1]);
      } catch (e: any) {
        Alert.alert('Lỗi tải dữ liệu', e?.message ?? 'Không tải được tài khoản/danh mục');
      } finally {
        setLoadingRefs(false);
      }
    })();
  }, []);

  // When the tab changes, reset category to a sensible default for that type.
  // Income tab → first category whose parent name looks income-y; otherwise first cat.
  useEffect(() => {
    if (categories.length === 0) {
      setCategory(null);
      return;
    }
    if (tab === 'transfer') {
      setCategory(null); // no category needed for transfers
      return;
    }
    const wanted = tab === 'income' ? /income|thu/i : /expense|chi|food|eat/i;
    const match = categories.find((c) => wanted.test(c.parent_name ?? ''));
    setCategory(match ?? categories[0]);
  }, [tab, categories]);

  function tap(key: string) {
    haptic.select();
    if (key === 'DEL') {
      setAmount(amount.length <= 1 ? '0' : amount.slice(0, -1));
      return;
    }
    if (amount === '0' && key !== '000') setAmount(key);
    else if ((amount + key).length <= 12) setAmount(amount + key);
  }

  /** Cycle the date back/forward by 1 day. */
  function bumpDate(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d);
    haptic.select();
  }

  function pickAccount(setter: (a: Account) => void, currentId?: string, excludeId?: string) {
    const choices = accounts.filter((a) => a.id !== excludeId);
    if (choices.length === 0) {
      Alert.alert('Chưa có tài khoản', 'Vui lòng thêm tài khoản trước.');
      return;
    }
    Alert.alert(
      'Chọn tài khoản',
      undefined,
      choices.map((a) => ({
        text: (currentId === a.id ? '✓ ' : '') + a.name,
        onPress: () => setter(a),
      })),
    );
  }

  function pickCategory() {
    if (categories.length === 0) {
      Alert.alert('Chưa có danh mục', 'Vui lòng thử lại sau.');
      return;
    }
    // Filter by tab type for cleaner UX
    const wanted =
      tab === 'income' ? /income|thu/i : /expense|chi|food|eat|trans/i;
    const filtered = categories.filter((c) => wanted.test(c.parent_name ?? ''));
    const list = filtered.length > 0 ? filtered : categories;
    // Alert can show many options on iOS but on Android the dialog truncates.
    // For now, show first 8 + "Khác" to open a fuller list later iteration.
    const shown = list.slice(0, 8);
    Alert.alert(
      'Chọn danh mục',
      undefined,
      [
        ...shown.map((c) => ({
          text: (category?.id === c.id ? '✓ ' : '') + c.name,
          onPress: () => setCategory(c),
        })),
        { text: 'Huỷ', style: 'cancel' as const },
      ],
    );
  }

  async function save() {
    const amt = Number(amount);
    if (!amt) {
      Alert.alert('Nhập số tiền trước');
      haptic.warning();
      return;
    }
    // Prevent ridiculously large inputs that may overflow DB or be accidental
    const MAX_ALLOWED = 1_000_000_000_000; // 1 trillion VND
    if (amt > MAX_ALLOWED) {
      Alert.alert('Số tiền quá lớn', 'Vui lòng nhập số nhỏ hơn 1.000.000.000.000');
      haptic.warning();
      return;
    }
    if (!fromAccount) {
      Alert.alert('Thiếu tài khoản', 'Vui lòng thêm 1 tài khoản trước khi tạo giao dịch.');
      haptic.warning();
      return;
    }
    if (tab === 'transfer') {
      if (!toAccount) {
        Alert.alert('Thiếu tài khoản nhận', 'Vui lòng chọn tài khoản nhận tiền.');
        haptic.warning();
        return;
      }
      if (toAccount.id === fromAccount.id) {
        Alert.alert('Trùng tài khoản', 'Tài khoản gửi và nhận phải khác nhau.');
        haptic.warning();
        return;
      }
    }

    setSaving(true);
    try {
      await transactionsApi.create({
        type: tab,
        amount: amt,
        date: ymd(date),
        name: note.trim() || undefined,
        category_id: tab === 'transfer' ? undefined : category ? Number(category.id) : undefined,
        from_account_id: Number(fromAccount.id),
        to_account_id: tab === 'transfer' && toAccount ? Number(toAccount.id) : undefined,
      } as any);
      haptic.success();
      router.back();
    } catch (e: any) {
      Alert.alert('Không lưu được', e?.message ?? 'Lỗi không xác định');
      haptic.error();
    } finally {
      setSaving(false);
    }
  }

  const display = amount === '0' ? '0' : Number(amount).toLocaleString('vi-VN');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={Colors.white} />
        </Pressable>
        <Text style={[Typography.headingM, { color: Colors.white }]}>Giao dịch mới</Text>
        <Pressable
          onPress={save}
          disabled={saving || loadingRefs}
          style={[styles.saveBtn, { backgroundColor: color }, (saving || loadingRefs) && { opacity: 0.6 }]}
        >
          <Text style={[Typography.buttonM, { color: Colors.white }]}>{saving ? '...' : 'Lưu'}</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.type}
            onPress={() => {
              haptic.select();
              setTab(t.type);
            }}
            style={[styles.tab, tab === t.type && { backgroundColor: t.color }]}
          >
            <Text style={[Typography.buttonM, { color: tab === t.type ? Colors.white : 'rgba(255,255,255,0.55)' }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.amountRow}>
        <Text style={[Typography.displayXL, { color: Colors.white }]} numberOfLines={1}>
          {display}
        </Text>
        <Text style={[Typography.headingL, { color: 'rgba(255,255,255,0.55)', marginLeft: 6 }]}>đ</Text>
      </View>

      <View style={styles.sheet}>
        <View style={styles.dragHandle} />

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          {/* Date row with -1/+1 day buttons */}
          <View style={styles.dateRow}>
            <Pressable onPress={() => bumpDate(-1)} style={styles.dateNav}>
              <Ionicons name="chevron-back" size={18} color={Colors.dark} />
            </Pressable>
            <View style={styles.dateCenter}>
              <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
              <Text style={[Typography.labelL, { marginLeft: 6 }]}>{dateLabel(date)}</Text>
            </View>
            <Pressable
              onPress={() => bumpDate(1)}
              style={[styles.dateNav, date >= new Date(new Date().setHours(23, 59, 59)) && { opacity: 0.3 }]}
              disabled={date >= new Date(new Date().setHours(23, 59, 59))}
            >
              <Ionicons name="chevron-forward" size={18} color={Colors.dark} />
            </Pressable>
          </View>

          {/* Account / Category chips */}
          <View style={styles.chipsRow}>
            {loadingRefs ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <>
                <Chip
                  icon="wallet-outline"
                  label={fromAccount?.name ?? 'Chọn tài khoản'}
                  onPress={() =>
                    pickAccount(
                      setFromAccount,
                      fromAccount?.id,
                      tab === 'transfer' ? toAccount?.id : undefined,
                    )
                  }
                />
                {tab === 'transfer' ? (
                  <Chip
                    icon="swap-horizontal-outline"
                    label={toAccount?.name ?? 'Tài khoản nhận'}
                    onPress={() => pickAccount(setToAccount, toAccount?.id, fromAccount?.id)}
                  />
                ) : (
                  <Chip
                    icon="pricetag-outline"
                    label={category?.name ?? 'Chọn danh mục'}
                    onPress={pickCategory}
                  />
                )}
              </>
            )}
          </View>

          <View style={styles.noteRow}>
            <Ionicons name="create-outline" size={20} color={Colors.textSecondary} />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Ghi chú (tùy chọn)..."
              placeholderTextColor={Colors.textDisabled}
              style={[styles.noteInput, Typography.bodyM]}
            />
          </View>

          <View style={styles.numpad}>
            {KEYS.map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row', flex: 1 }}>
                {row.map((k) => (
                  <View key={k} style={{ flex: 1, padding: 4 }}>
                    <Pressable
                      onPress={() => tap(k)}
                      style={({ pressed }) => [
                        styles.numKey,
                        k === 'DEL' && { backgroundColor: Colors.grey200 },
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      {k === 'DEL' ? (
                        <Ionicons name="backspace-outline" size={24} color={Colors.grey600} />
                      ) : (
                        <Text style={Typography.headingL}>{k}</Text>
                      )}
                    </Pressable>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function Chip({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.chip}>
      <Ionicons name={icon} size={14} color={Colors.textSecondary} />
      <Text style={[Typography.labelM, { marginLeft: 6, maxWidth: 140 }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dark },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full },
  tabs: {
    flexDirection: 'row',
    height: 44,
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.full,
    padding: 4,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  sheet: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dragHandle: { alignSelf: 'center', width: 40, height: 4, backgroundColor: Colors.grey200, borderRadius: 2 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    padding: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    ...Shadow.s,
  },
  dateNav: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  dateCenter: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    ...Shadow.s,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: Radius.m,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteInput: { flex: 1, marginLeft: 8, color: Colors.textPrimary },
  numpad: { height: 280, marginTop: 12, marginBottom: 16 },
  numKey: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.m,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.s,
  },
});
