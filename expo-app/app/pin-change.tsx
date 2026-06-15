import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius, Shadow } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { authApi } from '@/api/auth';
import { secureStorage } from '@/services/secureStorage';
import { haptic } from '@/utils/haptics';

type Stage = 'otp' | 'enter-new' | 'confirm-new' | 'done';

const OTP_LEN = 6;
const PIN_LEN = 6;

export default function PinChangeScreen() {
  const [stage, setStage] = useState<Stage>('otp');

  // OTP state
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LEN).fill(''));
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpRemainingSec, setOtpRemainingSec] = useState(300); // 5 min
  const [resendIn, setResendIn] = useState(60);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [dailyBlocked, setDailyBlocked] = useState(false);
  const [devOtp, setDevOtp] = useState<string>('');
  const [otpRequesting, setOtpRequesting] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const otpInputs = useRef<(TextInput | null)[]>([]);

  // PIN entry state
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const requestOtp = useCallback(async (silent = false) => {
    setOtpRequesting(true);
    try {
      const r = await authApi.pinChange.requestOtp();
      setOtpRemainingSec((r.expires_in_minutes ?? 5) * 60);
      setAttemptsRemaining(r.attempts_remaining);
      setDevOtp(r.dev_otp_code ?? '');
      setResendIn(60);
      setOtpDigits(Array(OTP_LEN).fill(''));
      setOtpError(null);
      if (!silent) haptic.success();
    } catch (e: any) {
      if (e?.dailyLimitReached) {
        setDailyBlocked(true);
        setOtpError(e.message);
      } else {
        Alert.alert('Lỗi', e?.message ?? 'Không gửi được mã OTP');
      }
      haptic.error();
    } finally {
      setOtpRequesting(false);
    }
  }, []);

  // Auto-fire first OTP request on mount
  useEffect(() => {
    requestOtp(true);
  }, [requestOtp]);

  // Countdown for OTP expiry
  useEffect(() => {
    if (stage !== 'otp' || dailyBlocked) return;
    if (otpRemainingSec <= 0) return;
    const t = setTimeout(() => setOtpRemainingSec((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, otpRemainingSec, dailyBlocked]);

  // Countdown for "Gửi lại" cooldown
  useEffect(() => {
    if (stage !== 'otp' || resendIn <= 0 || dailyBlocked) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, resendIn, dailyBlocked]);

  function onOtpChange(idx: number, v: string) {
    const ch = v.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[idx] = ch;
    setOtpDigits(next);
    setOtpError(null);
    if (ch && idx < OTP_LEN - 1) otpInputs.current[idx + 1]?.focus();
  }

  function applyDevOtp() {
    const cleaned = devOtp.replace(/\D/g, '').slice(0, OTP_LEN);
    if (cleaned.length !== OTP_LEN) return;
    setOtpDigits(cleaned.split(''));
    setOtpError(null);
    otpInputs.current[OTP_LEN - 1]?.focus();
    haptic.light();
  }

  async function verifyOtp() {
    const code = otpDigits.join('');
    if (code.length !== OTP_LEN) {
      setOtpError('Vui lòng nhập đủ 6 chữ số');
      haptic.error();
      return;
    }
    setOtpVerifying(true);
    try {
      await authApi.pinChange.verifyOtp(code);
      haptic.success();
      setStage('enter-new');
    } catch (e: any) {
      setOtpError(e?.message ?? 'Mã OTP không đúng');
      haptic.error();
    } finally {
      setOtpVerifying(false);
    }
  }

  async function onResend() {
    if (resendIn > 0 || dailyBlocked) return;
    await requestOtp();
  }

  // ============================== PIN handling ==============================

  function onPinKey(key: string) {
    haptic.select();
    const cur = stage === 'enter-new' ? newPin : confirmPin;
    const set = stage === 'enter-new' ? setNewPin : setConfirmPin;
    if (key === 'del') {
      set(cur.slice(0, -1));
      setPinError(null);
      return;
    }
    if (cur.length >= PIN_LEN) return;
    const next = cur + key;
    set(next);
    if (next.length === PIN_LEN) {
      if (stage === 'enter-new') {
        setTimeout(() => setStage('confirm-new'), 200);
      } else {
        finalizePin(newPin, next);
      }
    }
  }

  async function finalizePin(p1: string, p2: string) {
    if (p1 !== p2) {
      setPinError('Mã PIN không khớp, vui lòng nhập lại');
      haptic.error();
      setConfirmPin('');
      setStage('enter-new');
      setNewPin('');
      return;
    }
    await secureStorage.savePinHash(p1);
    haptic.success();
    setStage('done');
    setTimeout(() => router.back(), 1200);
  }

  // =============================== UI render ===============================

  const minutes = Math.floor(otpRemainingSec / 60);
  const seconds = otpRemainingSec % 60;
  const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={Colors.dark} />
          </Pressable>
          <Text style={Typography.headingM}>Đổi mã PIN</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* Step indicator */}
        <View style={styles.stepBar}>
          <StepDot label="OTP email" active={stage === 'otp'} done={stage !== 'otp'} />
          <View style={styles.stepLine} />
          <StepDot label="PIN mới" active={stage === 'enter-new' || stage === 'confirm-new'} done={stage === 'done'} />
          <View style={styles.stepLine} />
          <StepDot label="Xong" active={stage === 'done'} done={false} />
        </View>

        <ScrollView contentContainerStyle={{ padding: Space.pageHorizontal, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {stage === 'otp' ? (
            <>
              <Text style={[Typography.headingL, { marginTop: Space.s16 }]}>Xác thực qua email</Text>
              <Text style={[Typography.bodyM, { color: Colors.textSecondary, marginTop: 6 }]}>
                Mã OTP 6 số đã gửi tới email đăng ký. Có hiệu lực <Text style={{ fontWeight: '700' }}>5 phút</Text>.
              </Text>

              {/* Dev banner */}
              {devOtp ? (
                <Pressable onPress={applyDevOtp} style={styles.devBanner}>
                  <Ionicons name="bug-outline" size={16} color={Colors.dark} />
                  <Text style={[Typography.labelM, { marginLeft: 8, flex: 1 }]}>
                    Mã DEV: <Text style={{ fontWeight: '800' }}>{devOtp}</Text>
                  </Text>
                  <Text style={[Typography.caption, { color: Colors.textSecondary }]}>bấm để dùng</Text>
                </Pressable>
              ) : null}

              {/* Timer */}
              <View style={styles.timerRow}>
                <Ionicons name="time-outline" size={16} color={otpRemainingSec < 60 ? Colors.expense : Colors.textSecondary} />
                <Text style={[Typography.labelM, { marginLeft: 6, color: otpRemainingSec < 60 ? Colors.expense : Colors.textSecondary }]}>
                  Hết hạn sau {timerText}
                </Text>
              </View>

              {/* OTP cells */}
              <View style={styles.otpRow}>
                {otpDigits.map((d, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => {
                      otpInputs.current[i] = r;
                    }}
                    value={d}
                    onChangeText={(v) => onOtpChange(i, v)}
                    onKeyPress={(e) => {
                      if (e.nativeEvent.key === 'Backspace' && !otpDigits[i] && i > 0) otpInputs.current[i - 1]?.focus();
                    }}
                    keyboardType="number-pad"
                    maxLength={1}
                    editable={!dailyBlocked && otpRemainingSec > 0}
                    style={[
                      styles.otpCell,
                      d ? { borderColor: Colors.primary, borderWidth: 2 } : undefined,
                      Typography.headingL,
                      { textAlign: 'center' },
                    ]}
                  />
                ))}
              </View>

              {otpError ? (
                <Text style={[Typography.caption, { color: Colors.expense, marginTop: 10 }]}>{otpError}</Text>
              ) : null}

              {attemptsRemaining !== null && !dailyBlocked ? (
                <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 8 }]}>
                  Còn {attemptsRemaining} lần yêu cầu OTP trong hôm nay (giới hạn 3/ngày).
                </Text>
              ) : null}

              {dailyBlocked ? (
                <View style={styles.blockedBox}>
                  <Ionicons name="ban" size={24} color={Colors.expense} />
                  <Text style={[Typography.bodyM, { color: Colors.expense, marginTop: 6, textAlign: 'center' }]}>
                    Bạn đã hết lượt đổi PIN hôm nay. Vui lòng quay lại vào ngày mai.
                  </Text>
                  <Pressable onPress={() => router.replace('/(tabs)')} style={styles.exitToHome}>
                    <Text style={[Typography.buttonM, { color: Colors.white }]}>Về trang chủ</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <PrimaryButton
                    label="Xác nhận OTP"
                    onPress={verifyOtp}
                    loading={otpVerifying}
                    disabled={otpRemainingSec <= 0}
                    style={{ marginTop: Space.s24 }}
                  />

                  <View style={styles.resendRow}>
                    <Text style={[Typography.bodyM, { color: Colors.textSecondary }]}>
                      Không nhận được mã?{' '}
                    </Text>
                    {resendIn > 0 ? (
                      <Text style={[Typography.bodyM, { color: Colors.textSecondary }]}>Gửi lại sau {resendIn}s</Text>
                    ) : (
                      <Pressable onPress={onResend} disabled={otpRequesting}>
                        <Text style={[Typography.bodyM, { color: Colors.primary, fontWeight: '700' }]}>
                          {otpRequesting ? 'Đang gửi...' : 'Gửi lại'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )}
            </>
          ) : null}

          {stage === 'enter-new' || stage === 'confirm-new' ? (
            <View style={{ flex: 1 }}>
              <Text style={[Typography.headingL, { marginTop: Space.s16 }]}>
                {stage === 'enter-new' ? 'Đặt mã PIN mới' : 'Nhập lại mã PIN'}
              </Text>
              <Text style={[Typography.bodyM, { color: Colors.textSecondary, marginTop: 6 }]}>
                {stage === 'enter-new' ? 'Mã 6 chữ số bảo vệ ứng dụng' : 'Xác nhận lại mã PIN bạn vừa đặt'}
              </Text>

              <PinDots
                count={PIN_LEN}
                filled={(stage === 'enter-new' ? newPin : confirmPin).length}
                error={!!pinError}
              />

              {pinError ? (
                <Text style={[Typography.bodyM, { color: Colors.expense, textAlign: 'center', marginTop: 8 }]}>
                  {pinError}
                </Text>
              ) : null}

              <View style={styles.padWrap}>
                {(
                  ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'del'] as (string | null)[]
                ).map((k, i) => (
                  <View key={i} style={styles.padKey}>
                    {k === null ? null : (
                      <Pressable
                        onPress={() => onPinKey(k)}
                        style={({ pressed }) => [styles.padBtn, pressed && { opacity: 0.6 }]}
                      >
                        {k === 'del' ? (
                          <Ionicons name="backspace-outline" size={26} color={Colors.dark} />
                        ) : (
                          <Text style={Typography.headingXL}>{k}</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {stage === 'done' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View style={styles.doneCircle}>
                <Ionicons name="checkmark" size={64} color={Colors.white} />
              </View>
              <Text style={[Typography.displayM, { marginTop: 24 }]}>Đã đổi mã PIN!</Text>
              <Text style={[Typography.bodyM, { color: Colors.textSecondary, marginTop: 8 }]}>
                Mã PIN mới sẽ áp dụng từ lần mở app tiếp theo.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepDot({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={[
          styles.stepDot,
          active && { backgroundColor: Colors.primary, borderColor: Colors.primary },
          done && { backgroundColor: Colors.income, borderColor: Colors.income },
        ]}
      >
        {done ? <Ionicons name="checkmark" size={12} color={Colors.white} /> : null}
      </View>
      <Text style={[Typography.caption, { marginTop: 4, color: active || done ? Colors.dark : Colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

function PinDots({ count, filled, error }: { count: number; filled: number; error: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: Space.s40 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.pinDot,
            i < filled && { backgroundColor: error ? Colors.expense : Colors.dark, borderColor: error ? Colors.expense : Colors.dark },
          ]}
        />
      ))}
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
  stepBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border },
  devBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: Radius.m,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: Space.s16,
  },
  timerRow: { flexDirection: 'row', alignItems: 'center', marginTop: Space.s16 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Space.s16 },
  otpCell: {
    width: 48,
    height: 56,
    borderRadius: Radius.m,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  blockedBox: {
    marginTop: Space.s24,
    padding: 16,
    borderRadius: Radius.l,
    backgroundColor: Colors.expense + '15',
    alignItems: 'center',
  },
  exitToHome: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.dark,
  },
  resendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Space.s16 },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  padWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 'auto', marginBottom: Space.s24 },
  padKey: { width: '33.333%', padding: 6, alignItems: 'center' },
  padBtn: {
    width: '100%',
    height: 72,
    borderRadius: Radius.l,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.s,
  },
  doneCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.income,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.green,
  },
});
