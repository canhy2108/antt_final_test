import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Clipboard,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { totpApi, TotpStatus } from '@/api/totp';
import { haptic } from '@/utils/haptics';

type Phase = 'loading' | 'idle' | 'setup' | 'verify' | 'backup-codes' | 'enabled';

export default function TotpSetupScreen() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<TotpStatus | null>(null);
  const [setupData, setSetupData] = useState<{ secret: string; otpauth_url: string; qr_code_url: string } | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  useEffect(() => {
    (async () => {
      const s = await totpApi.status();
      setStatus(s);
      setPhase(s.enabled ? 'enabled' : 'idle');
    })();
  }, []);

  async function startSetup() {
    haptic.medium();
    setSubmitting(true);
    try {
      const data = await totpApi.setup();
      setSetupData(data);
      setPhase('setup');
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message ?? '');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode() {
    if (!code || code.length < 6) {
      setError('Nhập đủ 6 số');
      haptic.error();
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await totpApi.verify(code);
      haptic.success();
      if (res.backup_codes && res.backup_codes.length > 0) {
        setBackupCodes(res.backup_codes);
        setPhase('backup-codes');
      } else {
        setPhase('enabled');
      }
      setCode('');
    } catch (e: any) {
      setError(e?.message ?? 'Mã không đúng');
      haptic.error();
    } finally {
      setSubmitting(false);
    }
  }

  async function disable() {
    Alert.prompt?.(
      'Nhập mã 6 số để tắt 2FA',
      'Mở app Authenticator để lấy mã hiện tại',
      async (input?: string) => {
        if (!input) return;
        try {
          await totpApi.disable(input);
          haptic.success();
          Alert.alert('Đã tắt 2FA');
          setStatus({ ...status!, enabled: false });
          setPhase('idle');
        } catch (e: any) {
          Alert.alert('Lỗi', e?.message ?? '');
        }
      },
      'plain-text',
    );
  }

  function copyText(text: string, label: string) {
    Clipboard.setString(text);
    haptic.light();
    Alert.alert('Đã copy', label);
  }

  // ----- RENDER -----

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} title="Xác thực 2 bước" />
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'enabled') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} title="Xác thực 2 bước" />
        <ScrollView contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}>
          <View style={styles.enabledHero}>
            <View style={styles.shieldIcon}>
              <Ionicons name="shield-checkmark" size={56} color={Colors.income} />
            </View>
            <Text style={[Typography.displayM, { color: Colors.dark, marginTop: 16, textAlign: 'center' }]}>
              2FA đang bật
            </Text>
            <Text style={[Typography.bodyM, { color: Colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>
              Tài khoản được bảo vệ bởi mã 6 số từ Google Authenticator. Hacker cần cả mật khẩu lẫn điện thoại của bạn để đăng nhập.
            </Text>
          </View>

          <InfoTile icon="time-outline" label="Lần xác minh gần nhất" value={status?.last_verified_at ? new Date(status.last_verified_at).toLocaleString('vi-VN') : 'Chưa từng'} />
          <InfoTile icon="key-outline" label="Mã backup còn lại" value={`${status?.backup_codes_remaining ?? 0} / 8`} />

          <Pressable onPress={disable} style={[styles.dangerBtn, { marginTop: Space.s24 }]}>
            <Ionicons name="shield-outline" size={18} color={Colors.expense} />
            <Text style={[Typography.buttonM, { color: Colors.expense, marginLeft: 6 }]}>Tắt 2FA</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === 'idle') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} title="Xác thực 2 bước" />
        <ScrollView contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}>
          <View style={styles.hero}>
            <View style={[styles.shieldIcon, { backgroundColor: 'rgba(189,232,62,0.15)' }]}>
              <Ionicons name="shield-checkmark" size={56} color={Colors.primary} />
            </View>
            <Text style={[Typography.displayM, { marginTop: 16, textAlign: 'center' }]}>Bật xác thực 2 bước</Text>
            <Text style={[Typography.bodyM, { color: Colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>
              Dùng Google Authenticator để tạo mã 6 số mới mỗi 30 giây. Ngay cả khi lộ mật khẩu, hacker vẫn không vào được tài khoản.
            </Text>
          </View>

          <Text style={[Typography.labelL, { marginTop: Space.s24, marginBottom: 8 }]}>Bạn sẽ cần</Text>
          <RequirementRow icon="phone-portrait" text="Một ứng dụng Authenticator: Google Authenticator, Authy, hoặc Microsoft Authenticator" />
          <RequirementRow icon="key" text="Lưu lại 8 mã backup ở chỗ an toàn (hiện 1 lần duy nhất)" />

          <PrimaryButton label="Bắt đầu thiết lập" onPress={startSetup} loading={submitting} style={{ marginTop: Space.s24 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === 'setup' && setupData) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} title="Quét QR" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }} keyboardShouldPersistTaps="handled">
            <Text style={[Typography.bodyM, { textAlign: 'center', marginBottom: 16 }]}>
              Mở Google Authenticator → bấm <Text style={{ fontWeight: '700' }}>+</Text> → Quét mã QR
            </Text>

            <View style={styles.qrWrap}>
              <Image source={{ uri: setupData.qr_code_url }} style={styles.qr} resizeMode="contain" />
            </View>

            <Pressable onPress={() => copyText(setupData.secret, 'Secret key')} style={styles.secretRow}>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.caption, { color: Colors.textSecondary }]}>Hoặc nhập tay key này</Text>
                <Text style={[Typography.labelL, { marginTop: 2, fontFamily: 'monospace' }]} numberOfLines={1}>
                  {setupData.secret}
                </Text>
              </View>
              <Ionicons name="copy-outline" size={20} color={Colors.primary} />
            </Pressable>

            <View style={styles.divider} />

            <Text style={[Typography.labelL, { marginBottom: 6 }]}>Nhập mã 6 số từ app Authenticator</Text>
            <TextInput
              value={code}
              onChangeText={(v) => {
                setCode(v.replace(/\D/g, '').slice(0, 6));
                if (error) setError(null);
              }}
              keyboardType="number-pad"
              placeholder="000000"
              placeholderTextColor={Colors.grey400}
              maxLength={6}
              style={[styles.codeInput, Typography.headingL]}
            />

            {error ? (
              <Text style={[Typography.caption, { color: Colors.expense, marginTop: 8 }]}>{error}</Text>
            ) : null}

            <PrimaryButton label="Xác nhận" onPress={verifyCode} loading={submitting} disabled={code.length !== 6} style={{ marginTop: Space.s16 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (phase === 'backup-codes' && backupCodes) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Lưu 8 mã backup" onBack={null} />
        <ScrollView contentContainerStyle={{ padding: Space.pageHorizontal, paddingBottom: Space.s40 }}>
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={20} color={Colors.warning} />
            <Text style={[Typography.bodyS, { color: Colors.warning, marginLeft: 8, flex: 1, fontWeight: '700' }]}>
              Chỉ hiển thị 1 lần — chụp màn hoặc lưu vào trình quản lý mật khẩu NGAY
            </Text>
          </View>

          <View style={styles.codesGrid}>
            {backupCodes.map((bc, i) => (
              <View key={i} style={styles.codeChip}>
                <Text style={[Typography.labelL, { fontFamily: 'monospace' }]}>{bc}</Text>
              </View>
            ))}
          </View>

          <Pressable onPress={() => copyText(backupCodes.join('\n'), 'Đã copy 8 mã backup')} style={styles.copyAllBtn}>
            <Ionicons name="copy" size={18} color={Colors.dark} />
            <Text style={[Typography.buttonM, { color: Colors.dark, marginLeft: 8 }]}>Copy tất cả</Text>
          </Pressable>

          <PrimaryButton label="Đã lưu — Hoàn tất" onPress={() => setPhase('enabled')} style={{ marginTop: Space.s24 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

function Header({ onBack, title }: { onBack: (() => void) | null; title: string }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={Colors.dark} />
        </Pressable>
      ) : (
        <View style={{ width: 26 }} />
      )}
      <Text style={[Typography.headingM, { flex: 1, textAlign: 'center' }]}>{title}</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

function RequirementRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.reqRow}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <Text style={[Typography.bodyS, { marginLeft: 10, flex: 1 }]}>{text}</Text>
    </View>
  );
}

function InfoTile({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoTile}>
      <Ionicons name={icon} size={20} color={Colors.textSecondary} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[Typography.caption, { color: Colors.textSecondary }]}>{label}</Text>
        <Text style={[Typography.labelL, { marginTop: 2 }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.pageHorizontal,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingTop: 24 },
  enabledHero: { alignItems: 'center', padding: 24, borderRadius: Radius.xl, backgroundColor: 'rgba(34,197,94,0.10)', borderWidth: 1, borderColor: Colors.income },
  shieldIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(34,197,94,0.18)', alignItems: 'center', justifyContent: 'center' },
  reqRow: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, borderRadius: Radius.m, backgroundColor: Colors.surface, ...Shadow.s },
  infoTile: { flexDirection: 'row', alignItems: 'center', padding: 14, marginTop: 10, borderRadius: Radius.m, backgroundColor: Colors.surface, ...Shadow.s },
  qrWrap: { alignItems: 'center', padding: 16, borderRadius: Radius.l, backgroundColor: Colors.white, ...Shadow.s },
  qr: { width: 220, height: 220 },
  secretRow: { flexDirection: 'row', alignItems: 'center', padding: 14, marginTop: 12, borderRadius: Radius.m, backgroundColor: Colors.surface, ...Shadow.s },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Space.s24 },
  codeInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.m,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 16,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
    color: Colors.dark,
  },
  warningBox: { flexDirection: 'row', padding: 12, borderRadius: Radius.m, backgroundColor: '#FEF3C7' },
  codesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Space.s16 },
  codeChip: {
    width: '48%',
    padding: 12,
    borderRadius: Radius.m,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  copyAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: Space.s16, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.expense },
});
