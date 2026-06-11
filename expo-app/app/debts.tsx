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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { debtsLoansApi, DebtLoan } from '@/api/debtsLoans';
import { formatVND, formatShortDate } from '@/utils/format';
import { haptic } from '@/utils/haptics';

export default function DebtsScreen() {
  const [items, setItems] = useState<DebtLoan[]>([]);
  const [totals, setTotals] = useState({ lent_remaining: 0, borrowed_remaining: 0, overdue_count: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await debtsLoansApi.list();
      setItems(res.items);
      setTotals(res.totals);
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

  async function settleDebt(d: DebtLoan) {
    Alert.prompt?.(
      `Trả ${d.direction === 'lent' ? 'tiền' : 'nợ'}`,
      `Còn lại: ${formatVND(Number(d.remaining_amount))}`,
      async (input?: string) => {
        if (!input) return;
        const amount = parseInt(input.replace(/\D/g, ''), 10);
        if (!amount) return;
        try {
          const today = new Date().toISOString().slice(0, 10);
          await debtsLoansApi.settle(d.id, { amount, settled_on: today });
          haptic.success();
          await load();
        } catch (e: any) {
          Alert.alert('Lỗi', e?.message ?? '');
        }
      },
      'plain-text',
      '',
      'numeric',
    );
  }

  async function deleteDebt(d: DebtLoan) {
    Alert.alert(`Xoá "${d.counterparty_name}"?`, undefined, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          try {
            await debtsLoansApi.delete(d.id);
            haptic.success();
            await load();
          } catch (e: any) {
            Alert.alert('Lỗi', e?.message ?? '');
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
        <Text style={[Typography.headingM, { flex: 1, marginLeft: 12 }]}>Vay / Nợ</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            haptic.light();
            setShowAdd(true);
          }}
        >
          <Ionicons name="add" size={22} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: Colors.income + '15' }]}>
            <Text style={[Typography.bodyS, { color: Colors.income }]}>Cho mượn</Text>
            <Text style={[Typography.moneyM, { color: Colors.income, marginTop: 4 }]}>
              {formatVND(totals.lent_remaining)}
            </Text>
            <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
              {items.filter((i) => i.direction === 'lent' && i.status !== 'settled').length} khoản
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: Colors.expense + '15' }]}>
            <Text style={[Typography.bodyS, { color: Colors.expense }]}>Đi vay</Text>
            <Text style={[Typography.moneyM, { color: Colors.expense, marginTop: 4 }]}>
              {formatVND(totals.borrowed_remaining)}
            </Text>
            <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
              {items.filter((i) => i.direction === 'borrowed' && i.status !== 'settled').length} khoản
            </Text>
          </View>
        </View>

        {totals.overdue_count > 0 ? (
          <View style={styles.overdueBox}>
            <Ionicons name="warning" size={20} color={Colors.warning} />
            <Text style={[Typography.bodyM, { color: Colors.warning, marginLeft: 8, fontWeight: '700' }]}>
              {totals.overdue_count} khoản quá hạn
            </Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <Empty onAdd={() => setShowAdd(true)} />
        ) : (
          items.map((d) => (
            <DebtCard key={d.id} d={d} onSettle={() => settleDebt(d)} onDelete={() => deleteDebt(d)} />
          ))
        )}
      </ScrollView>

      {showAdd ? <AddDebtModal onClose={() => setShowAdd(false)} onSaved={load} /> : null}
    </SafeAreaView>
  );
}

function DebtCard({ d, onSettle, onDelete }: { d: DebtLoan; onSettle: () => void; onDelete: () => void }) {
  const isLent = d.direction === 'lent';
  const color = isLent ? Colors.income : Colors.expense;
  const completed = d.status === 'settled';
  const percent = (1 - Number(d.remaining_amount) / Number(d.principal_amount)) * 100;
  return (
    <View style={[styles.card, completed && { opacity: 0.6 }]}>
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={isLent ? 'arrow-up-circle' : 'arrow-down-circle'} size={22} color={color} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={Typography.headingS}>{d.counterparty_name}</Text>
          <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
            {isLent ? 'Cho mượn' : 'Đi vay'} · {formatShortDate(d.started_at)}
            {d.due_at ? ` → ${formatShortDate(d.due_at)}` : ''}
          </Text>
        </View>
        <Pressable onPress={onDelete} hitSlop={12} style={{ padding: 4 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={Colors.grey400} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
        <View>
          <Text style={[Typography.caption, { color: Colors.textSecondary }]}>Còn lại</Text>
          <Text style={[Typography.moneyM, { color, marginTop: 2 }]}>{formatVND(Number(d.remaining_amount))}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[Typography.caption, { color: Colors.textSecondary }]}>Gốc</Text>
          <Text style={[Typography.bodyM, { color: Colors.dark, marginTop: 2 }]}>{formatVND(Number(d.principal_amount))}</Text>
        </View>
      </View>

      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, percent))}%`, backgroundColor: completed ? Colors.income : color }]} />
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, completed && { backgroundColor: Colors.income + '20' }, d.is_overdue && !completed && { backgroundColor: Colors.warning + '20' }]}>
          <Text style={[Typography.caption, { color: completed ? Colors.income : d.is_overdue ? Colors.warning : Colors.dark, fontWeight: '700' }]}>
            {completed ? 'ĐÃ TRẢ XONG' : d.is_overdue ? 'QUÁ HẠN' : d.status === 'partially_settled' ? 'TRẢ MỘT PHẦN' : 'ĐANG MỞ'}
          </Text>
        </View>
        {!completed ? (
          <Pressable onPress={onSettle} style={styles.settleBtn}>
            <Text style={[Typography.labelM, { color: Colors.dark }]}>Ghi nhận trả</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
      <Ionicons name="people-outline" size={56} color={Colors.grey400} />
      <Text style={[Typography.headingM, { marginTop: 12 }]}>Chưa có khoản vay/nợ nào</Text>
      <Text style={[Typography.bodyS, { marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }]}>
        Theo dõi tiền cho bạn bè/người thân mượn — và tiền bạn đi vay
      </Text>
      <Pressable onPress={onAdd} style={styles.emptyCta}>
        <Ionicons name="add" size={18} color={Colors.dark} />
        <Text style={[Typography.buttonM, { color: Colors.dark, marginLeft: 6 }]}>Ghi nhận</Text>
      </Pressable>
    </View>
  );
}

function AddDebtModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [direction, setDirection] = useState<'lent' | 'borrowed'>('lent');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const amount = amountRaw ? parseInt(amountRaw, 10) : 0;

  async function submit() {
    if (!name.trim()) {
      setErr('Nhập tên người liên quan');
      return;
    }
    if (!amount) {
      setErr('Nhập số tiền');
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      await debtsLoansApi.create({
        direction,
        counterparty_name: name.trim(),
        counterparty_phone: phone.trim() || undefined,
        principal_amount: amount,
        started_at: new Date().toISOString().slice(0, 10),
      });
      haptic.success();
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? '');
      haptic.error();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={modalStyles.backdrop}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={[Typography.headingL, { textAlign: 'center', marginBottom: 16 }]}>Ghi nhận khoản mới</Text>

          <View style={modalStyles.directionRow}>
            <Pressable
              onPress={() => setDirection('lent')}
              style={[modalStyles.dirChip, direction === 'lent' && { backgroundColor: Colors.income, borderColor: Colors.income }]}
            >
              <Ionicons name="arrow-up-circle" size={18} color={direction === 'lent' ? Colors.white : Colors.income} />
              <Text style={[Typography.buttonM, { color: direction === 'lent' ? Colors.white : Colors.income, marginLeft: 6 }]}>
                Cho mượn
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setDirection('borrowed')}
              style={[modalStyles.dirChip, direction === 'borrowed' && { backgroundColor: Colors.expense, borderColor: Colors.expense }]}
            >
              <Ionicons name="arrow-down-circle" size={18} color={direction === 'borrowed' ? Colors.white : Colors.expense} />
              <Text style={[Typography.buttonM, { color: direction === 'borrowed' ? Colors.white : Colors.expense, marginLeft: 6 }]}>
                Đi vay
              </Text>
            </Pressable>
          </View>

          <Text style={[Typography.labelL, { marginTop: 16, marginBottom: 6 }]}>Tên người</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Anh A / Em B"
            placeholderTextColor={Colors.grey400}
            style={modalStyles.input}
          />

          <Text style={[Typography.labelL, { marginTop: 12, marginBottom: 6 }]}>SĐT (tuỳ chọn)</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="09xx..."
            placeholderTextColor={Colors.grey400}
            keyboardType="phone-pad"
            style={modalStyles.input}
          />

          <Text style={[Typography.labelL, { marginTop: 12, marginBottom: 6 }]}>Số tiền</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              value={amountRaw}
              onChangeText={(v) => setAmountRaw(v.replace(/\D/g, ''))}
              placeholder="0"
              placeholderTextColor={Colors.grey400}
              keyboardType="number-pad"
              style={[modalStyles.input, { paddingRight: 50 }]}
            />
            <Text style={modalStyles.suffix}>₫</Text>
          </View>
          {amount > 0 ? (
            <Text style={[Typography.bodyS, { color: Colors.textSecondary, marginTop: 6 }]}>{formatVND(amount)}</Text>
          ) : null}

          {err ? (
            <View style={modalStyles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.expense} />
              <Text style={[Typography.caption, { color: Colors.expense, marginLeft: 6, flex: 1 }]}>{err}</Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <Pressable onPress={onClose} style={modalStyles.cancel}>
              <Text style={[Typography.buttonM, { color: Colors.dark }]}>Huỷ</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Lưu" onPress={submit} loading={submitting} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.pageHorizontal, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: { flex: 1, padding: 14, borderRadius: Radius.l },
  overdueBox: { flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 12, borderRadius: Radius.m, backgroundColor: Colors.warning + '15', borderWidth: 1, borderColor: Colors.warning + '40' },
  card: { padding: 14, marginTop: 12, borderRadius: Radius.l, backgroundColor: Colors.surface, ...Shadow.s },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  barBg: { height: 6, backgroundColor: Colors.grey200, borderRadius: Radius.full, overflow: 'hidden', marginTop: 12 },
  barFill: { height: '100%', borderRadius: Radius.full },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.grey200 },
  settleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.primary },
  emptyCta: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: Radius.full, backgroundColor: Colors.primary },
});

const modalStyles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: Colors.background, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  handle: { width: 40, height: 4, backgroundColor: Colors.grey200, borderRadius: 2, alignSelf: 'center', marginVertical: 8 },
  directionRow: { flexDirection: 'row', gap: 8 },
  dirChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.m, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: Colors.dark },
  suffix: { position: 'absolute', right: 16, top: 14, fontSize: 18, color: Colors.textSecondary, fontWeight: '700' },
  errorBox: { flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 10, borderRadius: Radius.m, backgroundColor: Colors.expense + '15' },
  cancel: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
});
