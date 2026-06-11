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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius } from '@/theme';
import { biometricService } from '@/services/biometric';
import { secureStorage } from '@/services/secureStorage';
import { BiometricCapability } from '@/types';
import { haptic } from '@/utils/haptics';
import { verifyPin as checkPinHash, needsRehash, hashPin } from '@/utils/pinCrypto';

type Phase = 'biometric-scan' | 'pin-entry' | 'verified';
const FRAME_SIZE = 220;
const SCAN_HEIGHT = 220;

export default function BiometricLockScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cap, setCap] = useState<BiometricCapability | null>(null);
  const [phase, setPhase] = useState<Phase>('biometric-scan');
  const [busy, setBusy] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const pinInputRef = useRef<TextInput>(null);

  const scan = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    biometricService.getCapability().then(setCap);
  }, []);

  useEffect(() => {
    if (phase !== 'biometric-scan') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scan, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scan, phase]);

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
    if (cap === 'unavailable') return;
    if (phase !== 'biometric-scan') return;
    const t = setTimeout(() => authenticate(), 1000);
    return () => clearTimeout(t);
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
        haptic.success();
        setPhase('verified');
        setTimeout(() => router.replace('/(tabs)'), 600);
      } else {
        haptic.warning();
        setPinError('Mã PIN không đúng');
        setPinInput('');
      }
    } catch (err) {
      setPinError('Lỗi kiểm tra mã PIN');
    } finally {
      setBusy(false);
    }
  }

  const scanY = scan.interpolate({ inputRange: [0, 1], outputRange: [0, SCAN_HEIGHT] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  const showCamera = permission?.granted ?? false;
  const askedPermission = permission !== null;

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
          {/* phase has already been narrowed to 'biometric-scan' by the early-return above. */}
          <Ionicons name="lock-closed" size={20} color={Colors.white} />
        </Pressable>
        <Text style={[Typography.labelL, { color: Colors.white }]}>Đặt mặt vào khung</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        {(
          <>
            <View style={styles.faceFrameWrap}>
              <View style={styles.faceFrame}>
                {showCamera ? (
                  <CameraView style={StyleSheet.absoluteFill} facing="front" />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.cameraFallback]}>
                    <Ionicons name="person" size={120} color="rgba(255,255,255,0.15)" />
                  </View>
                )}

                <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]} />

                <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
                <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
                <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
                <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
              </View>

              {!showCamera && askedPermission ? (
                <Pressable onPress={requestPermission} style={styles.permBtn}>
                  <Ionicons name="camera-outline" size={14} color={Colors.dark} />
                  <Text style={[Typography.caption, { marginLeft: 4, color: Colors.dark, fontWeight: '700' }]}>Bật camera để hiệu ứng đẹp hơn</Text>
                </Pressable>
              ) : null}
            </View>

            <Pressable onPress={authenticate} style={styles.fingerWrap}>
              <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
              <View style={[styles.fingerCircle, { backgroundColor: 'rgba(189,232,62,0.10)', borderColor: Colors.primary }]}>
                <Ionicons name="finger-print" size={36} color={Colors.primary} />
              </View>
              <Text style={[Typography.labelM, { color: 'rgba(255,255,255,0.7)', marginTop: 12 }]}>{busy ? 'Đang xác thực…' : 'Chạm để thử lại'}</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Ionicons name="shield-checkmark" size={12} color="rgba(255,255,255,0.4)" />
        <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.4)', marginLeft: 6 }]}>Bảo vệ bởi Secure Enclave / Android Keystore</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0B0F' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 12 },
  faceFrameWrap: { alignItems: 'center', marginTop: 32 },
  faceFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: FRAME_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#1a1a22',
    position: 'relative',
  },
  cameraFallback: { alignItems: 'center', justifyContent: 'center' },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 12,
    elevation: 18,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: Colors.primary,
  },
  permBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  fingerWrap: { alignItems: 'center', marginTop: 28, position: 'relative' },
  pulseRing: {
    position: 'absolute',
    top: 0,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
  },
  fingerCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(189,232,62,0.10)',
    borderWidth: 2,
    borderColor: Colors.primary,
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
