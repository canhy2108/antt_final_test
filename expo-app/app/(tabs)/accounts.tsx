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
import { accountsApi } from '@/api/accounts';
import { Account } from '@/types';
import { formatVND } from '@/utils/format';
import { haptic } from '@/utils/haptics';

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await accountsApi.getAll();
      setAccounts(list);
    } catch (e: any) {
      setError(e?.message ?? 'Không tải được tài khoản');
      setAccounts([]);
    }
  }, []);

  // Refresh every time the tab is focused — picks up newly created accounts.
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

  const total = (accounts ?? []).reduce((s, a) => s + a.balance, 0);

  function openAdd() {
    haptic.light();
    router.push('/account/new');
  }

  function openNotifications() {
    haptic.light();
    Alert.alert(
      'Thông báo',
      'Tính năng thông báo (nhắc nhở ngân sách, giao dịch lớn) sẽ ra mắt sau khi gắn push notification.',
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Space.s40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={Typography.headingXL}>Tài khoản</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={styles.iconBtn} onPress={openNotifications} hitSlop={6}>
              <Ionicons name="notifications-outline" size={20} color={Colors.dark} />
            </Pressable>
            <Pressable style={styles.addBtn} onPress={openAdd} hitSlop={6}>
              <Ionicons name="add" size={22} color={Colors.primary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.totalCard}>
          <Text style={[Typography.bodyM, { color: 'rgba(28,28,30,0.7)' }]}>Tổng số dư</Text>
          <Text style={[Typography.moneyXL, { color: Colors.dark, marginTop: 4 }]}>{formatVND(total)}</Text>
          <View style={styles.pill}>
            <Text style={[Typography.caption, { color: Colors.dark, fontWeight: '800' }]}>
              {accounts?.length ?? 0} TÀI KHOẢN
            </Text>
          </View>
        </View>

        <Text
          style={[
            Typography.headingM,
            { paddingHorizontal: Space.pageHorizontal, marginTop: Space.s24, marginBottom: Space.s12 },
          ]}
        >
          Danh sách tài khoản
        </Text>

        <View style={{ paddingHorizontal: Space.pageHorizontal }}>
          {accounts == null ? (
            <ActivityIndicator color={Colors.primary} />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : accounts.length === 0 ? (
            <Empty onAdd={openAdd} />
          ) : (
            accounts.map((a) => <Tile key={a.id} acc={a} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ acc }: { acc: Account }) {
  return (
    <Pressable style={styles.tile}>
      <View style={[styles.iconWrap, { backgroundColor: (acc.color ?? '#888') + '20' }]}>
        <Ionicons name="wallet" size={20} color={acc.color} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={Typography.headingS}>{acc.name}</Text>
        <Text style={Typography.bodyS}>{acc.type}</Text>
      </View>
      <Text style={Typography.moneyS}>{formatVND(acc.balance)}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.grey400} style={{ marginLeft: 4 }} />
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
        <Ionicons name="wallet-outline" size={40} color={Colors.grey400} />
      </View>
      <Text style={[Typography.headingM, { marginTop: 12 }]}>Chưa có tài khoản nào</Text>
      <Text style={[Typography.bodyS, { marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }]}>
        Thêm ngân hàng / ví / tiền mặt đầu tiên để bắt đầu theo dõi
      </Text>
      <Pressable onPress={onAdd} style={styles.emptyCta} hitSlop={8}>
        <Ionicons name="add" size={18} color={Colors.dark} />
        <Text style={[Typography.buttonM, { color: Colors.dark, marginLeft: 6 }]}>Thêm tài khoản</Text>
      </Pressable>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
      <Ionicons name="alert-circle-outline" size={48} color={Colors.expense} />
      <Text style={[Typography.bodyM, { marginTop: 12, textAlign: 'center', paddingHorizontal: 24 }]}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.emptyCta} hitSlop={8}>
        <Ionicons name="reload" size={16} color={Colors.dark} />
        <Text style={[Typography.buttonM, { color: Colors.dark, marginLeft: 6 }]}>Thử lại</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Space.pageHorizontal,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.s,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCard: {
    marginHorizontal: Space.pageHorizontal,
    padding: Space.s20,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    ...Shadow.green,
  },
  pill: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(28,28,30,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 12,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    ...Shadow.s,
  },
  iconWrap: { width: 42, height: 42, borderRadius: Radius.m, alignItems: 'center', justifyContent: 'center' },
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
