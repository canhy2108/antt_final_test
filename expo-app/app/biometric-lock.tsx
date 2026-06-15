import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  BackHandler,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius } from '@/theme';
import { biometricService } from '@/services/biometric';
import { secureStorage } from '@/services/secureStorage';
import { BiometricCapability } from '@/types';
import { haptic } from '@/utils/haptics';
import { verifyPin as checkPinHash, needsRehash, hashPin } from '@/utils/pinCrypto';

/**
 * App-lock screen. Single OS biometric prompt on mount, PIN fallback if
 * the user cancels or biometric is unavailable. No fake camera UI in
 * front of the real OS prompt — that's what made it feel like the app
 * was asking the user to scan twice.
 */
type Phase = 'biometric-scan' | 'pin-entry' | 'verified';

/**
 * Khoá lũy tiến chống dò PIN. Dưới 5 lần sai: không khoá. Từ lần 5 trở đi
 * khoá tạm và tăng dần thời gian.
 */
function pinLockDelayMs(failCount: number): number {
  if (failCount < 5) return 0;
  if (failCount === 5) return 30_000; // 30 giây
  if (failCount === 6) return 60_000; // 1 phút
  if (failCount === 7) return 5 * 60_000; // 5 phút
  return 15 * 60_000; // 15 phút cho lần thứ 8+
}

export default function BiometricLockScreen() {
  const [cap, setCap] = useState<BiometricCapability | null>(null);
  const [phase, setPhase] = useState<Phase>('biometric-scan');
  const [busy, setBusy] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const pinInputRef = useRef<TextInput>(null);
  const promptFiredRef = useRef(false);

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    biometricService.getCapability().then(setCap);
  }, []);

  useEffect(() => {
    if (phase !== 'biometric-scan') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, phase]);

  useEffect(() => {
    if (cap === null) return;
    if (phase !== 'biometric-scan') return;
    // No biometric hardware on this device — go straight to PIN entry.
    if (cap === 'unavailable') {
      setPhase('pin-entry');
      return;
    }
    // Fire OS prompt exactly once per mount. Strict-mode / fast-refresh
    // can re-run this effect; the ref guard prevents stacked prompts.
    if (promptFiredRef.current) return;
    promptFiredRef.current = true;
    authenticate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap, phase]);

  useEffect(() => {
    function onBack(): boolean {
      if (phase === 'verified') return false;
      return true;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [phase]);

  async function authenticate() {
    if (busy || phase !== 'biometric-scan') return;
    setBusy(true);
    try {
      const r = await biometricService.authenticate('Mở khoá BudgetBee');
      if (r === 'success') {
        haptic.success();
        setPhase('verified');
        setTimeout(() => router.replace('/(tabs)'), 600);
      } else {
        haptic.warning();
        setPhase('pin-entry');
      }
    } finally {
      setBusy(false);
    }
  }

  async function verifyPin() {
    if (busy || pinInput.length !== 6) return;

    // Chống dò: nếu đang bị khoá tạm thì chặn, không kiểm tra PIN.
    const guard = await secureStorage.getPinGuard();
    const now = Date.now();
    if (guard.lockUntil > now) {
      const secs = Math.ceil((guard.lockUntil - now) / 1000);
      setPinError(`Quá nhiều lần sai. Thử lại sau ${secs}s`);
      setPinInput('');
      return;
    }

    setBusy(true);
    setPinError(null);
    try {
      const stored = await secureStorage.getPinHash();
      if (!stored) {
        setPinError('Chưa cài đặt mã PIN');
        setBusy(false);
        return;
      }
      const ok = await checkPinHash(pinInput, stored);
      if (ok) {
        // One-shot migration: if the old build wrote the PIN in plaintext,
        // upgrade it to a salted hash now that we know the raw value works.
        if (needsRehash(stored)) {
          try {
            const upgraded = await hashPin(pinInput);
            await secureStorage.writeRawPinHash(upgraded);
          } catch {
            // Best-effort migration; failing to upgrade is not a fatal unlock error.
          }
        }
        await secureStorage.clearPinGuard();
        haptic.success();
        setPhase('verified');
        setTimeout(() => router.replace('/(tabs)'), 600);
      } else {
        // Sai PIN → tăng bộ đếm + khoá lũy tiến.
        const count = guard.count + 1;
        const delay = pinLockDelayMs(count);
        const until = delay ? Date.now() + delay : 0;
        await secureStorage.setPinGuard(count, until);
        haptic.warning();
        setPinError(
          delay
            ? `Sai PIN ${count} lần. Tạm khoá ${Math.round(delay / 1000)}s`
            : 'Mã PIN không đúng',
        );
        setPinInput('');
      }
    } catch (err) {
      setPinError('Lỗi kiểm tra mã PIN');
    } finally {
      setBusy(false);
    }
  }

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  if (phase === 'pin-entry') {
    return <PinEntryPhase pinInput={pinInput} setPinInput={setPinInput} busy={busy} pinError={pinError} onVerify={verifyPin} inputRef={pinInputRef} />;
  }

  if (phase === 'verified') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={async () => {
              haptic.light();
              router.replace('/(auth)/login');
            }}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.white} />
          </Pressable>
          <Text style={[Typography.labelL, { color: Colors.white }]}>Đã xác thực</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.body}>
          <Text style={[Typography.displayM, { color: Colors.white, textAlign: 'center', marginTop: 40 }]}>Đã xác thực ✓</Text>
          <Text style={[Typography.bodyM, { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 8 }]}>Đang vào ứng dụng…</Text>
        </View>

        <View style={styles.footer}>
          <Ionicons name="shield-checkmark" size={12} color="rgba(255,255,255,0.4)" />
          <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.4)', marginLeft: 6 }]}>Bảo vệ bởi Secure Enclave / Android Keystore</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={async () => {
            haptic.light();
            router.replace('/(auth)/login');
          }}
          hitSlop={12}
        >
          <Ionicons name="lock-closed" size={20} color={Colors.white} />
        </Pressable>
        <Text style={[Typography.labelL, { color: Colors.white }]}>BudgetBee đang khoá</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <Pressable onPress={authenticate} style={styles.fingerWrap}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
          <View style={[styles.fingerCircle, { backgroundColor: 'rgba(189,232,62,0.10)', borderColor: Colors.primary }]}>
            <Ionicons name="finger-print" size={64} color={Colors.primary} />
          </View>
          <Text style={[Typography.headingM, { color: Colors.white, marginTop: 24, textAlign: 'center' }]}>
            {busy ? 'Đang xác thực…' : 'Xác thực để mở khoá'}
          </Text>
          <Text style={[Typography.bodyS, { color: 'rgba(255,255,255,0.55)', marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }]}>
            Dùng vân tay hoặc khuôn mặt của thiết bị. Nếu cần, chạm vào biểu tượng để thử lại.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            haptic.light();
            setPhase('pin-entry');
          }}
          style={styles.pinFallbackBtn}
        >
          <Ionicons name="keypad-outline" size={16} color="rgba(255,255,255,0.8)" />
          <Text style={[Typography.buttonM, { color: 'rgba(255,255,255,0.8)', marginLeft: 6 }]}>Dùng mã PIN</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Ionicons name="shield-checkmark" size={12} color="rgba(255,255,255,0.4)" />
        <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.4)', marginLeft: 6 }]}>Bảo vệ bởi Secure Enclave / Android Keystore</Text>
      </View>
    </SafeAreaView>
  );
}

const FINGER_HUB = 140;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0B0F' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  fingerWrap: { alignItems: 'center', marginTop: 48, position: 'relative' },
  pulseRing: {
    position: 'absolute',
    top: 0,
    width: FINGER_HUB,
    height: FINGER_HUB,
    borderRadius: FINGER_HUB / 2,
    backgroundColor: Colors.primary,
  },
  fingerCircle: {
    width: FINGER_HUB,
    height: FINGER_HUB,
    borderRadius: FINGER_HUB / 2,
    backgroundColor: 'rgba(189,232,62,0.10)',
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space.s24,
  },
});

function PinEntryPhase({
  pinInput,
  setPinInput,
  busy,
  pinError,
  onVerify,
  inputRef,
}: {
  pinInput: string;
  setPinInput: (val: string) => void;
  busy: boolean;
  pinError: string | null;
  onVerify: () => void;
  inputRef?: React.RefObject<TextInput | null>;
}) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.body}>
          <Text style={[Typography.displayM, { color: Colors.white, textAlign: 'center', marginTop: 40 }]}>Nhập mã PIN</Text>
          <Text style={[Typography.bodyM, { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 8 }]}>Mã PIN 6 chữ số để mở khoá</Text>

          <PinInputWidget value={pinInput} onChange={setPinInput} error={pinError} onSubmit={onVerify} busy={busy} inputRef={inputRef} />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function PinInputWidget({
  value,
  onChange,
  error,
  onSubmit,
  busy,
  inputRef,
}: {
  value: string;
  onChange: (val: string) => void;
  error: string | null;
  onSubmit: () => void;
  busy: boolean;
  inputRef?: React.RefObject<TextInput | null>;
}) {
  return (
    <View style={{ marginTop: 48, width: '100%' }}>
      <TextInput
        ref={inputRef}
        style={{ position: 'absolute', width: 0, height: 0 }}
        keyboardType="numeric"
        maxLength={6}
        value={value}
        onChangeText={(text) => {
          const num = text.replace(/\D/g, '').slice(0, 6);
          onChange(num);
          if (num.length === 6) setTimeout(onSubmit, 300);
        }}
        autoFocus
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              marginHorizontal: 8,
              backgroundColor: i < value.length ? Colors.white : 'rgba(255,255,255,0.12)',
            }}
          />
        ))}
      </View>

      {error ? <Text style={{ color: 'salmon', textAlign: 'center', marginTop: 10 }}>{error}</Text> : null}
    </View>
  );
}
