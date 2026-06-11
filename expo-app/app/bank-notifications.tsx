/**
 * Bank notification review screen.
 *
 * Hiển thị queue các notification ngân hàng mà BudgetBee đã bóc tách
 * được nhưng chưa lưu vào DB. User đối chiếu từng item, sửa tài khoản /
 * category nếu cần, rồi bấm "Lưu" để gọi API tạo record.
 *
 * Khi mode = 'auto' và confidence ≥ 0.85, các giao dịch đã được tự lưu
 * và KHÔNG xuất hiện ở đây. Đây chỉ là hàng đợi cho mode 'confirm' hoặc
 * các item bị reject khỏi auto (low confidence / không match account).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { haptic } from '@/utils/haptics';
import {
  approvePending,
  loadPending,
  PendingImport,
  removePending,
} from '@/services/bankAutoImport';
import { Account } from '@/types';
import { accountsApi } from '@/api/accounts';
import { formatVND } from '@/utils/format';

export default function BankNotificationsScreen() {
  const [items, setItems] = useState<PendingImport[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, accs] = await Promise.all([loadPending(), accountsApi.getAll()]);
      setItems(pending);
      setAccounts(accs);
    } catch (e) {
      // Best-effort; nếu lỗi network thì pending vẫn hiển thị (đã load trước)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  async function onApprove(item: PendingImport) {
    if (busyId) return;
    let accountId = item.guessedAccountId;

    if (!accountId) {
      // Không tự match được account → bắt user chọn.
      if (accounts.length === 0) {
        Alert.alert('Chưa có tài khoản', 'Vui lòng tạo tài khoản trước khi duyệt giao dịch.');
        return;
      }
      Alert.alert(
        'Chọn tài khoản',
        `Giao dịch ${item.parsed.direction === 'income' ? '+' : '-'}${formatVND(item.parsed.amount)} thuộc tài khoản nào?`,
        accounts.map((a) => ({
          text: a.name,
          onPress: () => approveWithAccount(item, a.id),
        })),
      );
      return;
    }
    await approveWithAccount(item, accountId);
  }

  async function approveWithAccount(item: PendingImport, accountId: string) {
    setBusyId(item.id);
    try {
      await approvePending(item.id, { accountId });
      haptic.success();
      await refresh();
    } catch (e: any) {
      Alert.alert('Không lưu được', e?.message ?? 'Vui lòng thử lại');
      haptic.error();
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(item: PendingImport) {
    Alert.alert(
      'Bỏ qua giao dịch?',
      'Item này sẽ bị xoá khỏi hàng đợi và KHÔNG tạo record. Bạn vẫn có thể nhập tay sau.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Bỏ qua',
          style: 'destructive',
          onPress: async () => {
            await removePending(item.id);
            haptic.light();
            await refresh();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={Colors.dark} />
        </Pressable>
        <Text style={Typography.headingM}>Giao dịch từ thông báo</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primaryDark} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle-outline" size={64} color={Colors.income} />
          <Text style={[Typography.headingM, { marginTop: 16 }]}>Không có gì chờ duyệt</Text>
          <Text style={[Typography.bodyS, { color: Colors.textSecondary, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 }]}>
            Khi nhận thông báo từ ngân hàng, các giao dịch BudgetBee bóc được sẽ xuất hiện ở đây để bạn duyệt.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}>
          {items.map((item) => (
            <PendingCard
              key={item.id}
              item={item}
              accounts={accounts}
              busy={busyId === item.id}
              onApprove={() => onApprove(item)}
              onReject={() => onReject(item)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PendingCard({
  item,
  accounts,
  busy,
  onApprove,
  onReject,
}: {
  item: PendingImport;
  accounts: Account[];
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const p = item.parsed;
  const isIncome = p.direction === 'income';
  const guessedAccount = item.guessedAccountId
    ? accounts.find((a) => a.id === item.guessedAccountId)
    : null;
  return (
    <View style={[styles.card, isIncome ? styles.cardIncome : styles.cardExpense]}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.cardIcon,
            { backgroundColor: isIncome ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)' },
          ]}
        >
          <Ionicons
            name={isIncome ? 'arrow-down' : 'arrow-up'}
            size={20}
            color={isIncome ? Colors.income : Colors.expense}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={Typography.headingS}>
            {isIncome ? '+' : '-'}{formatVND(p.amount)}
          </Text>
          <Text style={[Typography.bodyS, { color: Colors.textSecondary }]} numberOfLines={1}>
            {p.bankName} · {new Date(item.event.timestamp).toLocaleString('vi-VN')}
          </Text>
        </View>
        <ConfidencePill value={p.confidence} />
      </View>

      <Text style={[Typography.bodyM, { marginTop: 12 }]} numberOfLines={3}>
        {p.description || p.rawText}
      </Text>

      <View style={styles.metaRow}>
        <MetaChip
          icon="wallet-outline"
          label={guessedAccount?.name ?? (p.accountLast4 ? `TK *${p.accountLast4}` : 'Chưa khớp tài khoản')}
          warn={!guessedAccount}
        />
        {p.balanceAfter !== null ? (
          <MetaChip icon="cash-outline" label={`Số dư: ${formatVND(p.balanceAfter)}`} />
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onReject} style={[styles.btn, styles.btnGhost]} disabled={busy}>
          <Text style={[Typography.buttonM, { color: Colors.dark }]}>Bỏ qua</Text>
        </Pressable>
        <Pressable
          onPress={onApprove}
          style={[styles.btn, styles.btnPrimary, busy && { opacity: 0.6 }]}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={[Typography.buttonM, { color: Colors.white }]}>Lưu giao dịch</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ConfidencePill({ value }: { value: number }) {
  const label = value >= 0.85 ? 'Cao' : value >= 0.6 ? 'Vừa' : 'Thấp';
  const color = value >= 0.85 ? Colors.income : value >= 0.6 ? Colors.warning : Colors.expense;
  return (
    <View style={[styles.pill, { backgroundColor: color + '20' }]}>
      <Text style={[Typography.caption, { color, fontWeight: '700' }]}>{label}</Text>
    </View>
  );
}

function MetaChip({
  icon,
  label,
  warn,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  warn?: boolean;
}) {
  return (
    <View style={[styles.metaChip, warn && { backgroundColor: '#FEF3C7' }]}>
      <Ionicons name={icon} size={12} color={warn ? Colors.warning : Colors.textSecondary} />
      <Text
        style={[
          Typography.caption,
          { marginLeft: 4, color: warn ? Colors.warning : Colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.l,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    ...Shadow.s,
  },
  cardIncome: { borderColor: 'rgba(34,197,94,0.30)' },
  cardExpense: { borderColor: 'rgba(239,68,68,0.20)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, height: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  btnPrimary: { backgroundColor: Colors.primary },
});
