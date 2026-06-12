import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, StatusBar, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { biometricApi } from '@/api/biometric';
import { biometricService } from '@/services/biometric';
import { useAuth } from '@/stores/auth';
import { haptic } from '@/utils/haptics';
import { openOsBiometricSettings, osBiometricSettingsHint } from '@/utils/biometricSettings';

/**
 * Unified biometric login — Task 1 + Task 2.
 *
 * ONE screen for both fingerprint and Face ID. The OS picks the modality; we
 * never draw a face camera or a fingerprint pad ourselves. This replaces the
 * old `face-login` + `finger-login` screens entirely.
 *
 * Why there is NO in-app "scan" animation:
 *   The old screens drew a sweeping ring / progress bar BEFORE the OS prompt,
 *   so the user felt they had already scanned — then the real OS prompt asked
 *   them to scan AGAIN. That "double scan" is the exact bug we kill here.
 *   Opening this screen IS the trigger; the OS biometric sheet is the only
 *   scan UI. The spinner below means "waiting for the OS", not "scanning you".
 *
 * `startedRef` fires the OS prompt exactly once per mount — StrictMode / fast
 * refresh in dev would otherwise stack two prompts back-to-back.
 */
type Phase =
  | 'checking'
  | 'os-not-enrolled'
  | 'app-not-enrolled'
  | 'authenticating'
  | 'success'
  | 'failed';

export default function BiometricLoginScreen() {
  const setUser = useAuth((s) => s.setUser);

  const [phase, setPhase] = useState<Phase>('checking');
  const [kind, setKind] = useState<'face' | 'fingerprint'>('fingerprint');
  const [matchedEmail, setMatchedEmail] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      // Pick the icon/label up front (face vs finger) so the copy is honest.
      setKind(await biometricService.primaryKind());

      // Pre-flight 1 — does the OS have ANY biometric enrolled? If not, the
      // OS prompt would just bounce back "not_enrolled"; send them to Settings.
      const cap = await biometricService.getCapability();
      if (cap === 'unavailable') {
        setPhase('os-not-enrolled');
        return;
      }
      // Pre-flight 2 — has the user enabled biometric login for THIS app on
      // THIS device? If not, there's no credential to unlock; point them back
      // to password + the setup screen instead of firing a pointless prompt.
      const hasCred = await biometricApi.hasAnyEnrolled();
      if (!hasCred) {
        setPhase('app-not-enrolled');
        return;
      }
      runOsBiometricLogin();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runOsBiometricLogin() {
    setErrorText(null);
    setPhase('authenticating');
    try {
      // The single OS prompt fires inside here: SecureStore releases the
      // device-bound bio_token only after Face ID / fingerprint succeeds.
      const { user, matchedBy } = await biometricApi.loginByBiometric();
      setKind(matchedBy);
      setUser(user);
      setMatchedEmail(user.email);
      haptic.success();
      setPhase('success');
      setTimeout(() => router.replace('/(tabs)'), 600);
    } catch (e: any) {
      haptic.error();
      setErrorText(e?.message ?? 'Không xác thực được sinh trắc học');
      setPhase('failed');
    }
  }

  async function recheckCapability() {
    const cap = await biometricService.getCapability();
    if (cap === 'unavailable') {
      setPhase('os-not-enrolled');
      return;
    }
    const hasCred = await biometricApi.hasAnyEnrolled();
    if (!hasCred) {
      setPhase('app-not-enrolled');
      return;
    }
    runOsBiometricLogin();
  }

  const kindLabel = kind === 'face' ? 'khuôn mặt' : 'vân tay';
  const kindIcon: keyof typeof Ionicons.glyphMap = kind === 'face' ? 'happy-outline' : 'finger-print';

  // ---- OS has no biometric enrolled at all ----
  if (phase === 'os-not-enrolled') {
    return (
      <SafeAreaView style={styles.bg} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <Header title="Đăng nhập sinh trắc học" onClose={() => router.back()} />
        <View style={styles.center}>
          <IconCircle name="warning" tone="warn" />
          <Text style={[Typography.headingL, styles.titleText]}>Thiết bị chưa bật sinh trắc học</Text>
          <Text style={[Typography.bodyM, styles.hintText]}>
            Hệ điều hành chưa đăng ký khuôn mặt / vân tay nào, BudgetBee không thể quét. Hãy bật trong Cài đặt thiết bị trước.
            {'\n\n'}
            {osBiometricSettingsHint()}
          </Text>
          <View style={styles.actionRow}>
            <GhostBtn label="Dùng mật khẩu" onPress={() => router.back()} />
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Mở Cài đặt"
                onPress={async () => {
                  const opened = await openOsBiometricSettings();
                  if (!opened) setErrorText('Không mở được Cài đặt. Vui lòng vào Cài đặt thủ công.');
                }}
              />
            </View>
          </View>
          <Pressable onPress={recheckCapability} style={{ marginTop: 16 }}>
            <Text style={[Typography.buttonM, { color: Colors.primary }]}>Tôi đã bật xong — Kiểm tra lại</Text>
          </Pressable>
          {errorText ? (
            <Text style={[Typography.bodyS, { color: Colors.expense, textAlign: 'center', marginTop: 12 }]}>
              {errorText}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  // ---- OS ok, but no app credential on this device ----
  if (phase === 'app-not-enrolled') {
    return (
      <SafeAreaView style={styles.bg} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <Header title="Đăng nhập sinh trắc học" onClose={() => router.back()} />
        <View style={styles.center}>
          <IconCircle name={kindIcon} tone="muted" />
          <Text style={[Typography.headingL, styles.titleText]}>Chưa bật đăng nhập sinh trắc</Text>
          <Text style={[Typography.bodyM, styles.hintText]}>
            Trên thiết bị này bạn chưa bật đăng nhập bằng {kindLabel}. Hãy đăng nhập bằng mật khẩu một lần, rồi vào
            Cài đặt → Sinh trắc học để bật.
          </Text>
          <View style={styles.actionRow}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Dùng mật khẩu" onPress={() => router.back()} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ---- checking / authenticating / success / failed ----
  const isChecking = phase === 'checking';
  const isAuthenticating = phase === 'authenticating';
  const isSuccess = phase === 'success';
  const isFailed = phase === 'failed';

  const title = isSuccess
    ? matchedEmail
      ? `Đăng nhập với ${matchedEmail}`
      : 'Đăng nhập thành công'
    : isFailed
    ? 'Không xác thực được'
    : isChecking
    ? 'Đang kiểm tra thiết bị'
    : `Đang xác thực bằng ${kindLabel}`;

  const hint = isSuccess
    ? `Đã xác thực bằng ${kindLabel} của thiết bị`
    : isFailed
    ? errorText ?? 'Vui lòng thử lại hoặc đăng nhập bằng mật khẩu'
    : isChecking
    ? 'Đang kiểm tra sinh trắc OS…'
    : 'Làm theo cửa sổ xác thực của hệ điều hành';

  const hubIcon: keyof typeof Ionicons.glyphMap = isSuccess ? 'checkmark' : isFailed ? 'close' : kindIcon;
  const hubTone: Tone = isSuccess ? 'ok' : isFailed ? 'bad' : 'primary';

  return (
    <SafeAreaView style={styles.bg} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <Header
        title="Đăng nhập sinh trắc học"
        onClose={isAuthenticating || isChecking ? undefined : () => router.back()}
      />

      <View style={styles.center}>
        <View style={styles.iconHub}>
          <IconCircle name={hubIcon} tone={hubTone} />
          {isAuthenticating || isChecking ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
          ) : null}
        </View>

        <Text style={[Typography.headingL, styles.titleText]}>{title}</Text>
        <Text style={[Typography.bodyM, styles.hintText]}>{hint}</Text>

        {isFailed ? (
          <View style={styles.actionRow}>
            <GhostBtn label="Dùng mật khẩu" onPress={() => router.back()} />
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Thử lại" onPress={runOsBiometricLogin} />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Ionicons name="shield-checkmark" size={12} color="rgba(255,255,255,0.4)" />
        <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.4)', marginLeft: 6 }]}>
          Xác thực bởi Secure Enclave / Android Keystore + token gắn thiết bị
        </Text>
      </View>
    </SafeAreaView>
  );
}

/* ----------------------------- UI helpers ----------------------------- */

function Header({ title, onClose }: { title: string; onClose?: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onClose} hitSlop={12} disabled={!onClose}>
        <Ionicons name="close" size={28} color={onClose ? Colors.white : 'rgba(255,255,255,0.3)'} />
      </Pressable>
      <Text style={[Typography.headingM, { color: Colors.white }]}>{title}</Text>
      <View style={{ width: 28 }} />
    </View>
  );
}

function GhostBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.secondaryBtn} onPress={onPress}>
      <Text style={[Typography.buttonM, { color: Colors.white }]}>{label}</Text>
    </Pressable>
  );
}

type Tone = 'primary' | 'ok' | 'bad' | 'warn' | 'muted';

function IconCircle({ name, tone }: { name: keyof typeof Ionicons.glyphMap; tone: Tone }): ReactNode {
  const palette: Record<Tone, { bg: string; border: string; fg: string }> = {
    primary: { bg: 'rgba(189,232,62,0.10)', border: Colors.primary, fg: Colors.primary },
    ok: { bg: 'rgba(34,197,94,0.18)', border: Colors.income, fg: Colors.income },
    bad: { bg: 'rgba(239,68,68,0.12)', border: Colors.expense, fg: Colors.expense },
    warn: { bg: 'rgba(245,158,11,0.12)', border: '#F59E0B', fg: '#F59E0B' },
    muted: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.25)', fg: 'rgba(255,255,255,0.8)' },
  };
  const c = palette[tone];
  return (
    <View style={[styles.iconCircle, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Ionicons name={name} size={72} color={c.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0B0B0F' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.pageHorizontal,
    paddingVertical: 12,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  iconHub: { alignItems: 'center', justifyContent: 'center' },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: { color: Colors.white, textAlign: 'center', marginTop: 32 },
  hintText: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 8, paddingHorizontal: 24 },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Space.s24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space.s24,
  },
});
