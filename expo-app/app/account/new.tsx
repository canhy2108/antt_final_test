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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { accountsApi, AccountType, UserCurrencyShape } from '@/api/accounts';
import { VN_BANKS, VnBank } from '@/data/vietnamBanks';
import { haptic } from '@/utils/haptics';
import { formatVND } from '@/utils/format';

export default function NewAccountScreen() {
  const [types, setTypes] = useState<AccountType[]>([]);
  const [currencies, setCurrencies] = useState<UserCurrencyShape[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [picked, setPicked] = useState<VnBank | null>(null);
  const [name, setName] = useState('');
  const [balanceRaw, setBalanceRaw] = useState(''); // digits-only
  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [ts, cs] = await Promise.all([accountsApi.getTypes(), accountsApi.getCurrencies()]);
        setTypes(ts);
        setCurrencies(cs);
        // Default to VND if present, else first
        const vnd = cs.find((c) => c.code === 'VND');
        setCurrencyId(vnd?.id ?? cs[0]?.id ?? null);
      } catch (e: any) {
        setError(e?.message ?? 'Không tải được dữ liệu');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function pick(bank: VnBank) {
    haptic.light();
    setPicked(bank);
    setError(null); // user is making progress — clear any stale error
    if (!name.trim()) setName(bank.fullName);
  }

  function onBalanceChange(s: string) {
    // strip everything except digits — formatted display is computed
    setBalanceRaw(s.replace(/\D/g, '').slice(0, 14));
    if (error) setError(null); // typing = progress, hide stale error
  }

  function onNameChange(v: string) {
    setName(v);
    if (error) setError(null);
  }

  const balance = balanceRaw ? parseInt(balanceRaw, 10) : 0;
  const balanceDisplay = balance > 0 ? formatVND(balance) : '';

  const selectedCurrency = useMemo(
    () => currencies.find((c) => c.id === currencyId),
    [currencies, currencyId],
  );

  async function submit() {
    if (!picked) {
      setError('Vui lòng chọn loại tài khoản / ngân hàng');
      haptic.error();
      return;
    }
    if (!name.trim()) {
      setError('Vui lòng đặt tên tài khoản');
      haptic.error();
      return;
    }
    if (!currencyId) {
      setError('Không có đơn vị tiền tệ — vui lòng thử lại sau');
      haptic.error();
      return;
    }
    const typeId = types.find((t) => t.name === picked.defaultTypeName)?.id ?? types[0]?.id;
    if (!typeId) {
      setError('Hệ thống thiếu loại tài khoản — liên hệ admin');
      haptic.error();
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await accountsApi.create({
        name: name.trim(),
        type_id: typeId,
        color: picked.color,
        initial_balance: balance,
        currency_id: currencyId,
      });
      haptic.success();
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Không tạo được tài khoản');
      haptic.error();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={26} color={Colors.dark} />
          </Pressable>
          <Text style={Typography.headingM}>Thêm tài khoản</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Connect Bank (Demo) — opens the 4-step simulated link flow */}
          <Pressable
            style={styles.betaCard}
            onPress={() => {
              haptic.light();
              router.push('/account/connect-bank');
            }}
          >
            <View style={styles.betaIcon}>
              <Ionicons name="link" size={18} color={Colors.dark} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={Typography.headingS}>Kết nối ngân hàng tự động</Text>
              <Text style={[Typography.caption, { marginTop: 2 }]}>
                Đăng nhập Internet Banking → đồng bộ số dư + giao dịch
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </Pressable>

          <Text style={[Typography.labelL, { marginTop: Space.s20, marginBottom: 10 }]}>Chọn ngân hàng / loại ví</Text>
          <View style={styles.grid}>
            {VN_BANKS.map((b) => (
              <BankTile key={b.id} bank={b} active={picked?.id === b.id} onPress={() => pick(b)} />
            ))}
          </View>

          <Text style={[Typography.labelL, { marginTop: Space.s24, marginBottom: 6 }]}>Tên tài khoản</Text>
          <TextInput
            value={name}
            onChangeText={onNameChange}
            placeholder="VD: Vietcombank lương, Tiền mặt ví..."
            placeholderTextColor={Colors.grey400}
            style={styles.input}
          />

          <Text style={[Typography.labelL, { marginTop: Space.s20, marginBottom: 6 }]}>Số dư ban đầu</Text>
          <View style={styles.balanceWrap}>
            <TextInput
              value={balanceRaw}
              onChangeText={onBalanceChange}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.grey400}
              style={[styles.input, { paddingRight: 80, flex: 1 }]}
            />
            <Text style={styles.balanceSuffix}>{selectedCurrency?.symbol ?? '₫'}</Text>
          </View>
          {balanceDisplay ? (
            <Text style={[Typography.bodyS, { color: Colors.textSecondary, marginTop: 6 }]}>
              {balanceDisplay}
            </Text>
          ) : null}

          {currencies.length > 1 ? (
            <>
              <Text style={[Typography.labelL, { marginTop: Space.s20, marginBottom: 6 }]}>Đơn vị tiền tệ</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {currencies.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      haptic.light();
                      setCurrencyId(c.id);
                    }}
                    style={[
                      styles.currencyChip,
                      currencyId === c.id && { backgroundColor: Colors.dark },
                    ]}
                  >
                    <Text
                      style={[
                        Typography.labelM,
                        { color: currencyId === c.id ? Colors.primary : Colors.dark },
                      ]}
                    >
                      {c.symbol} {c.code}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={Colors.expense} />
              <Text style={[Typography.bodyS, { color: Colors.expense, marginLeft: 8, flex: 1 }]}>{error}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label={loading ? 'Đang tải...' : 'Thêm tài khoản'}
            onPress={submit}
            loading={submitting}
            style={{ marginTop: Space.s24 }}
            disabled={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BankTile({ bank, active, onPress }: { bank: VnBank; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.bankTile, { backgroundColor: bank.color + (active ? 'FF' : '15') }]}
    >
      <View style={[styles.bankBadge, { backgroundColor: active ? '#FFFFFF' : bank.color }]}>
        <Text
          style={[
            Typography.labelM,
            { color: active ? bank.color : '#FFFFFF', fontWeight: '800' },
          ]}
        >
          {bank.shortName}
        </Text>
      </View>
      <Text
        style={[Typography.caption, { color: active ? '#FFFFFF' : Colors.dark, fontWeight: '700' }]}
        numberOfLines={1}
      >
        {bank.fullName}
      </Text>
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
  betaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: Radius.l,
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
  },
  betaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F59E0B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bankTile: {
    width: '31%',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: Radius.m,
    alignItems: 'center',
    gap: 6,
  },
  bankBadge: {
    minWidth: 40,
    height: 28,
    borderRadius: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  balanceWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  balanceSuffix: {
    position: 'absolute',
    right: 16,
    fontSize: 18,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  currencyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
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
