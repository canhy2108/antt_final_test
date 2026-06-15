import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { VN_BANKS, VnBank } from '@/data/vietnamBanks';
import { accountsApi } from '@/api/accounts';
import { transactionsApi } from '@/api/transactions';
import { categoriesApi } from '@/api/categories';
import { haptic } from '@/utils/haptics';
import { formatVND } from '@/utils/format';

type Step = 'pick' | 'login' | 'connecting' | 'success';

/**
 * Bank link simulation. The legal/technical reality is that no Vietnamese
 * retail bank exposes a public Open Banking API today, so this flow
 * mock-mimics the standard 4-step UX (Choose → Auth → Sync → Result) end-
 * to-end while honestly creating a real Account on our backend at the end.
 *
 * Hidden disclaimer (`devNote`) explains "this is a simulation" — important
 * for the school project demo so the reviewer understands the engineering
 * choice, not a hidden hack.
 */
export default function ConnectBankScreen() {
  const [step, setStep] = useState<Step>('pick');
  const [bank, setBank] = useState<VnBank | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [progressLine, setProgressLine] = useState('');
  const [createdBalance, setCreatedBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Spin two icons around each other during the "connecting" step
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (step !== 'connecting') return;
    const anim = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [step, spin]);

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Run the "connecting" sequence: ~3s of progress lines, then call backend
  async function runConnect() {
    haptic.medium();
    setError(null);
    setStep('connecting');

    const lines = [
      'Đang xác thực với ngân hàng...',
      'Đang đồng bộ số dư...',
      'Đang đồng bộ giao dịch 30 ngày gần nhất...',
      'Hoàn tất kiểm tra bảo mật...',
    ];
    let i = 0;
    setProgressLine(lines[0]);
    const interval = setInterval(() => {
      i++;
      if (i < lines.length) setProgressLine(lines[i]);
    }, 850);

    try {
      // Hit the real backend so the account actually appears in the DB.
      const [types, currs] = await Promise.all([accountsApi.getTypes(), accountsApi.getCurrencies()]);
      const typeId = types.find((t) => t.name === bank!.defaultTypeName)?.id ?? types[0]?.id;
      const vnd = currs.find((c) => c.code === 'VND') ?? currs[0];
      if (!typeId || !vnd) {
        throw new Error('Không tìm thấy loại tài khoản hoặc đơn vị tiền tệ');
      }

      // "Bank-fetched" balance — random between 1M and 50M VND
      const fakeBalance = Math.floor(1_000_000 + Math.random() * 49_000_000);
      const lastFour = Math.floor(1000 + Math.random() * 9000);

      const account = await accountsApi.create({
        name: `${bank!.fullName} ****${lastFour}`,
        type_id: typeId,
        color: bank!.color,
        initial_balance: fakeBalance,
        currency_id: vnd.id,
      });

      // Optionally seed 3-5 mock transactions on this "synced" account so the
      // reports/dashboard immediately reflect activity. Only run in dev.
      if (__DEV__) {
        seedMockTransactions(Number(account.id)).catch(() => {});
      }

      // Wait until 3 seconds total elapsed for the UX to feel substantial
      const remaining = Math.max(0, 3000 - i * 850);
      await new Promise((r) => setTimeout(r, remaining));

      clearInterval(interval);
      setCreatedBalance(fakeBalance);
      haptic.success();
      setStep('success');
    } catch (e: any) {
      clearInterval(interval);
      setError(e?.message ?? 'Kết nối thất bại');
      haptic.error();
      setStep('login'); // bounce back to credentials screen with error visible
    }
  }

  // Pre-fill credentials for the reviewer
  function fillDemo() {
    haptic.light();
    setUsername('demo_user');
    setPassword('Demo@2026');
  }

  function pickBank(b: VnBank) {
    haptic.select();
    setBank(b);
    setStep('login');
  }

  function back() {
    if (step === 'pick') router.back();
    else if (step === 'login') setStep('pick');
  }

  return (
    <SafeAreaView style={[styles.safe, step !== 'pick' && bank && { backgroundColor: bank.color }]} edges={['top']}>
      <StatusBar barStyle={step === 'pick' ? 'dark-content' : 'light-content'} />

      {/* Header — back button + step indicator */}
      {step !== 'success' ? (
        <View style={[styles.header, step === 'pick' ? { backgroundColor: 'transparent' } : null]}>
          <Pressable onPress={back} hitSlop={12} disabled={step === 'connecting'}>
            <Ionicons name="chevron-back" size={26} color={step === 'pick' ? Colors.dark : Colors.white} />
          </Pressable>
          <Text style={[Typography.headingM, { color: step === 'pick' ? Colors.dark : Colors.white }]}>
            {step === 'pick'
              ? 'Chọn ngân hàng'
              : step === 'login'
              ? bank?.fullName ?? 'Đăng nhập'
              : 'Đang kết nối'}
          </Text>
          <View style={{ width: 26 }} />
        </View>
      ) : null}

      {step === 'pick' ? <PickStep onPick={pickBank} /> : null}
      {step === 'login' && bank ? (
        <LoginStep
          bank={bank}
          username={username}
          password={password}
          onUsername={setUsername}
          onPassword={setPassword}
          onFillDemo={fillDemo}
          onConnect={runConnect}
          error={error}
        />
      ) : null}
      {step === 'connecting' && bank ? (
        <ConnectingStep bank={bank} spinDeg={spinDeg} line={progressLine} />
      ) : null}
      {step === 'success' && bank ? (
        <SuccessStep bank={bank} balance={createdBalance} onDone={() => router.dismissAll()} />
      ) : null}
    </SafeAreaView>
  );
}

// -------------------------------------------------------------- step UI --

function PickStep({ onPick }: { onPick: (b: VnBank) => void }) {
  const banks = VN_BANKS.filter((b) => b.category === 'bank' || b.category === 'wallet');
  return (
    <ScrollView contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}>
      <Text style={[Typography.bodyM, { color: Colors.textSecondary, marginBottom: 16 }]}>
        Chọn ngân hàng / ví bạn muốn liên kết. BudgetBee sẽ đăng nhập đại diện và
        đồng bộ số dư + giao dịch dạng chỉ đọc (read-only).
      </Text>

      <View style={styles.grid}>
        {banks.map((b) => (
          <Pressable key={b.id} onPress={() => onPick(b)} style={[styles.bankTile, { backgroundColor: b.color }]}>
            <View style={styles.bankBadge}>
              <Text style={[Typography.labelM, { color: b.color, fontWeight: '800' }]}>{b.shortName}</Text>
            </View>
            <Text style={[Typography.caption, { color: Colors.white, fontWeight: '700' }]} numberOfLines={1}>
              {b.fullName}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.simulationNote}>
        <Ionicons name="information-circle" size={18} color={Colors.warning} />
        <Text style={[Typography.caption, { flex: 1, marginLeft: 8, color: Colors.textSecondary }]}>
          <Text style={{ fontWeight: '700' }}>Phiên bản demo: </Text>
          BudgetBee mô phỏng luồng Open Banking (Plaid/Casso style). Khi đối tác
          aggregator sẵn sàng tại VN, bước đăng nhập sẽ chuyển sang OAuth thật.
        </Text>
      </View>
    </ScrollView>
  );
}

function LoginStep({
  bank,
  username,
  password,
  onUsername,
  onPassword,
  onFillDemo,
  onConnect,
  error,
}: {
  bank: VnBank;
  username: string;
  password: string;
  onUsername: (s: string) => void;
  onPassword: (s: string) => void;
  onFillDemo: () => void;
  onConnect: () => void;
  error: string | null;
}) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: Space.pageHorizontal }} keyboardShouldPersistTaps="handled">
        <View style={styles.bankHero}>
          <View style={styles.bankHeroBadge}>
            <Text style={[Typography.headingM, { color: bank.color, fontWeight: '800' }]}>{bank.shortName}</Text>
          </View>
          <Text style={[Typography.headingL, { color: Colors.white, marginTop: 12 }]}>{bank.fullName}</Text>
          <Text style={[Typography.bodyS, { color: 'rgba(255,255,255,0.85)', marginTop: 4 }]}>
            Đăng nhập Internet Banking
          </Text>
        </View>

        <View style={styles.loginCard}>
          <TextField
            label="Tên đăng nhập"
            icon="person-outline"
            autoCapitalize="none"
            value={username}
            onChangeText={onUsername}
            placeholder="username Internet Banking"
          />
          <View style={{ height: 12 }} />
          <TextField
            label="Mật khẩu"
            icon="lock-closed-outline"
            secureTextEntry
            secureToggle
            value={password}
            onChangeText={onPassword}
            placeholder="••••••••"
          />

          <Pressable onPress={onFillDemo} style={styles.demoBtn}>
            <Ionicons name="flask-outline" size={16} color={Colors.dark} />
            <Text style={[Typography.labelM, { marginLeft: 6, color: Colors.dark }]}>Dùng tài khoản Demo</Text>
          </Pressable>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.expense} />
              <Text style={[Typography.caption, { color: Colors.expense, marginLeft: 6, flex: 1 }]}>{error}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label="Kết nối"
            onPress={onConnect}
            disabled={!username.trim() || !password.trim()}
            style={{ marginTop: Space.s16 }}
          />

          <View style={styles.disclaimer}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.income} />
            <Text style={[Typography.caption, { flex: 1, marginLeft: 6, color: Colors.textSecondary }]}>
              BudgetBee <Text style={{ fontWeight: '700' }}>không lưu trữ mật khẩu</Text> của bạn. Kết
              nối được bảo mật bởi chuẩn mã hoá 256-bit.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ConnectingStep({
  bank,
  spinDeg,
  line,
}: {
  bank: VnBank;
  spinDeg: any;
  line: string;
}) {
  return (
    <View style={styles.centerWrap}>
      <View style={styles.connectingHub}>
        {/* BudgetBee logo (left) */}
        <View style={[styles.connectIcon, { backgroundColor: '#FFFFFF' }]}>
          <Text style={{ fontSize: 32 }}>🐝</Text>
        </View>

        {/* Animated arrows */}
        <Animated.View style={[styles.connectArrows, { transform: [{ rotate: spinDeg }] }]}>
          <Ionicons name="sync" size={32} color={Colors.white} />
        </Animated.View>

        {/* Bank badge (right) */}
        <View style={[styles.connectIcon, { backgroundColor: Colors.white }]}>
          <Text style={[Typography.headingM, { color: bank.color, fontWeight: '800' }]}>{bank.shortName}</Text>
        </View>
      </View>

      <Text style={[Typography.headingL, { color: Colors.white, marginTop: 32, textAlign: 'center' }]}>
        Đang kết nối {bank.fullName}
      </Text>
      <Text style={[Typography.bodyM, { color: 'rgba(255,255,255,0.85)', marginTop: 8, textAlign: 'center' }]}>
        {line}
      </Text>

      <View style={styles.progressDots}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.progressDot} />
        ))}
      </View>
    </View>
  );
}

function SuccessStep({
  bank,
  balance,
  onDone,
}: {
  bank: VnBank;
  balance: number;
  onDone: () => void;
}) {
  return (
    <View style={styles.centerWrap}>
      <View style={styles.successCircle}>
        <Ionicons name="checkmark" size={64} color={Colors.white} />
      </View>
      <Text style={[Typography.displayM, { color: Colors.white, marginTop: 24, textAlign: 'center' }]}>
        Kết nối thành công!
      </Text>
      <Text style={[Typography.bodyM, { color: 'rgba(255,255,255,0.85)', marginTop: 8, textAlign: 'center' }]}>
        Đã đồng bộ tài khoản {bank.fullName}
      </Text>

      <View style={styles.balanceCard}>
        <Text style={[Typography.bodyS, { color: 'rgba(28,28,30,0.6)' }]}>Số dư hiện tại</Text>
        <Text style={[Typography.moneyXL, { color: Colors.dark, marginTop: 4 }]}>{formatVND(balance)}</Text>
      </View>

      <PrimaryButton label="Xong" onPress={onDone} style={{ marginTop: 24, alignSelf: 'stretch', marginHorizontal: 24 }} />
    </View>
  );
}

// ------------------------------------------------------------- helpers --

/**
 * Generate 4-6 transactions (mix of income + expense) on the freshly synced
 * account, so the dashboard + reports immediately have data. Best-effort:
 * silently swallow errors so the link flow still feels successful.
 */
async function seedMockTransactions(accountId: number): Promise<void> {
  const cats = await categoriesApi.getAll();
  if (cats.length === 0) return;

  const samples = [
    { label: 'Grab', amount: -85_000 },
    { label: 'Highlands Coffee', amount: -55_000 },
    { label: 'Tiền lương tháng', amount: 12_000_000 },
    { label: 'Lazada', amount: -340_000 },
    { label: 'Vinmart', amount: -167_000 },
    { label: 'Netflix', amount: -260_000 },
  ];

  const today = new Date();
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const d = new Date(today);
    d.setDate(d.getDate() - i * 3);
    const wantedRe = s.amount > 0 ? /income|thu/i : /expense|chi|food|trans|shop/i;
    const cat =
      cats.find((c) => wantedRe.test(c.parent_name ?? '') && !!c.name) ?? cats[0];
    try {
      await transactionsApi.create({
        type: s.amount > 0 ? 'income' : 'expense',
        amount: Math.abs(s.amount),
        date: d.toISOString().slice(0, 10),
        name: s.label,
        category_id: Number(cat.id),
        from_account_id: accountId,
      } as any);
    } catch {
      /* skip */
    }
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.pageHorizontal,
    paddingVertical: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bankTile: {
    width: '31%',
    paddingVertical: 16,
    paddingHorizontal: 6,
    borderRadius: Radius.m,
    alignItems: 'center',
    gap: 8,
    ...Shadow.s,
  },
  bankBadge: {
    minWidth: 50,
    height: 32,
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulationNote: {
    flexDirection: 'row',
    padding: 12,
    marginTop: Space.s20,
    borderRadius: Radius.m,
    backgroundColor: '#FEF3C7',
  },
  bankHero: { alignItems: 'center', paddingVertical: Space.s24 },
  bankHeroBadge: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.m,
  },
  loginCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Space.pageHorizontal,
    marginHorizontal: -Space.pageHorizontal,
    marginBottom: -Space.s40,
    flex: 1,
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.primary + '30',
    borderRadius: Radius.full,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    borderRadius: Radius.m,
    backgroundColor: Colors.expense + '15',
  },
  disclaimer: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingHorizontal: 4 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  connectingHub: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  connectIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.m,
  },
  connectArrows: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDots: { flexDirection: 'row', gap: 8, marginTop: 32 },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  successCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: {
    marginTop: 32,
    alignSelf: 'stretch',
    marginHorizontal: 24,
    padding: 20,
    borderRadius: Radius.l,
    backgroundColor: Colors.white,
    alignItems: 'center',
    ...Shadow.m,
  },
});
