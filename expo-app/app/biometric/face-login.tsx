import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { biometricApi } from '@/api/biometric';
import { useAuth } from '@/stores/auth';
import { haptic } from '@/utils/haptics';

/**
 * Face login screen.
 *
 * SECURITY: The real biometric check is the OS Face ID / Face Unlock prompt
 * triggered inside `biometricApi.loginByFace`. The on-screen camera + scan
 * animation is purely visual feedback so the UX feels like "the app is
 * scanning your face" — but the actual match happens in the OS Secure
 * Enclave / StrongBox, and the device-bound credential bound to THIS user
 * is only released after the OS confirms the real account owner is present.
 *
 * Why we don't try to match faces ourselves on the server:
 *   - We don't ship a face-embedding model; without one any "server-side
 *     face match" is at best a guess (the previous code matched the
 *     most-recently-enrolled user, which let any face log into the latest
 *     account). Doing OS biometric + device-bound credential is how Apple
 *     Wallet, Alipay, and Techcombank actually do it.
 */
type Phase = 'positioning' | 'scanning' | 'uploading' | 'success' | 'failed';

const FRAME_W = 240;
const FRAME_H = 320;
const SCAN_DURATION_MS = 1800;

export default function FaceLoginScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const setUser = useAuth((s) => s.setUser);

  const [phase, setPhase] = useState<Phase>('positioning');
  const [scanProgress, setScanProgress] = useState(0);
  const [matchedEmail, setMatchedEmail] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const scanStartRef = useRef<number | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sweep = useRef(new Animated.Value(0)).current;
  const cornerPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase === 'success' || phase === 'failed') {
      sweep.stopAnimation();
      return;
    }
    const speed = phase === 'scanning' || phase === 'uploading' ? 600 : 1100;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: speed, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: speed, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep, phase]);

  useEffect(() => {
    if (phase !== 'scanning' && phase !== 'uploading') {
      cornerPulse.stopAnimation();
      cornerPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cornerPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(cornerPulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [cornerPulse, phase]);

  function startScan() {
    setErrorText(null);
    haptic.medium();
    setPhase('scanning');
    scanStartRef.current = Date.now();
    setScanProgress(0);
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    scanTimerRef.current = setInterval(() => {
      if (scanStartRef.current === null) return;
      const elapsed = Date.now() - scanStartRef.current;
      const p = Math.min(1, elapsed / SCAN_DURATION_MS);
      setScanProgress(p);
      if (elapsed >= SCAN_DURATION_MS) {
        runOsBiometricLogin();
      }
    }, 50);
  }

  async function runOsBiometricLogin() {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    scanStartRef.current = null;
    setPhase('uploading');

    try {
      // Real biometric verification happens INSIDE this call:
      //   - OS Face ID / Face Unlock prompt fires (Secure Enclave / StrongBox)
      //   - Stored device-bound bio_token is released only on OS pass
      //   - Server constant-time-verifies hash, returns user + Sanctum token
      const { user } = await biometricApi.loginByFace();
      setUser(user);
      setMatchedEmail(user.email);
      haptic.success();
      setPhase('success');
      setTimeout(() => router.replace('/(tabs)'), 800);
    } catch (e: any) {
      haptic.error();
      setErrorText(e?.message ?? 'Không xác thực được khuôn mặt');
      setPhase('failed');
    }
  }

  function retry() {
    setErrorText(null);
    setMatchedEmail(null);
    setPhase('positioning');
  }

  // ---------------------------------------------------------------- RENDER

  if (!permission) return <View style={styles.bg} />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.bg} edges={['top']}>
        <View style={styles.fullCenter}>
          <Ionicons name="camera-outline" size={56} color={Colors.primary} />
          <Text style={[Typography.headingL, { color: Colors.white, marginTop: 16, textAlign: 'center' }]}>
            Cần truy cập camera
          </Text>
          <Text style={[Typography.bodyM, { color: 'rgba(255,255,255,0.7)', marginTop: 8, textAlign: 'center' }]}>
            Camera dùng để hiển thị khung quét. Khớp khuôn mặt thực sự được xác minh bởi OS.
          </Text>
          <PrimaryButton label="Cho phép camera" onPress={requestPermission} style={{ marginTop: 28 }} />
          <Pressable onPress={() => router.back()} style={{ marginTop: 14 }}>
            <Text style={[Typography.buttonM, { color: Colors.white }]}>Huỷ</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isSuccess = phase === 'success';
  const isScanning = phase === 'scanning';
  const isUploading = phase === 'uploading';
  const isFailed = phase === 'failed';

  const ovalColor = isSuccess
    ? Colors.income
    : isUploading
    ? '#FBBF24'
    : isScanning
    ? Colors.primary
    : isFailed
    ? Colors.expense
    : 'rgba(255,255,255,0.45)';

  const sweepY = sweep.interpolate({ inputRange: [0, 1], outputRange: [0, FRAME_H] });
  const cornerOpacity = cornerPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  const title = isSuccess
    ? matchedEmail
      ? `Đăng nhập với ${matchedEmail}`
      : 'Đăng nhập thành công'
    : isUploading
    ? 'Đang xác thực với OS...'
    : isScanning
    ? 'Giữ yên — đang quét'
    : isFailed
    ? 'Không xác thực được'
    : 'Đưa mặt vào trong khung';

  const hint = isSuccess
    ? 'Đã xác thực bằng Face ID của thiết bị'
    : isUploading
    ? 'OS đang xác minh khuôn mặt của chủ tài khoản'
    : isScanning
    ? 'Đầu thẳng, mắt nhìn camera'
    : isFailed
    ? errorText ?? 'Vui lòng thử lại hoặc đăng nhập bằng mật khẩu'
    : 'Bấm "Bắt đầu quét" khi đã căn đúng khung';

  return (
    <SafeAreaView style={styles.bg} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} disabled={isScanning || isUploading}>
          <Ionicons name="close" size={28} color={isScanning || isUploading ? 'rgba(255,255,255,0.3)' : Colors.white} />
        </Pressable>
        <Text style={[Typography.headingM, { color: Colors.white }]}>Đăng nhập khuôn mặt</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.frameWrap}>
        <View style={[styles.frame, { borderColor: ovalColor }]}>
          {!isFailed ? <CameraView style={StyleSheet.absoluteFill} facing="front" /> : null}

          {!isSuccess && !isFailed ? (
            <Animated.View
              style={[styles.sweepLine, { backgroundColor: ovalColor, transform: [{ translateY: sweepY }] }]}
            />
          ) : null}

          <Animated.View
            style={[
              styles.cornerBracket,
              { top: 12, left: 12, borderTopWidth: 3, borderLeftWidth: 3, borderColor: ovalColor, opacity: isScanning || isUploading ? cornerOpacity : 1 },
            ]}
          />
          <Animated.View
            style={[
              styles.cornerBracket,
              { top: 12, right: 12, borderTopWidth: 3, borderRightWidth: 3, borderColor: ovalColor, opacity: isScanning || isUploading ? cornerOpacity : 1 },
            ]}
          />
          <Animated.View
            style={[
              styles.cornerBracket,
              { bottom: 12, left: 12, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: ovalColor, opacity: isScanning || isUploading ? cornerOpacity : 1 },
            ]}
          />
          <Animated.View
            style={[
              styles.cornerBracket,
              { bottom: 12, right: 12, borderBottomWidth: 3, borderRightWidth: 3, borderColor: ovalColor, opacity: isScanning || isUploading ? cornerOpacity : 1 },
            ]}
          />

          {isSuccess ? (
            <View style={styles.successOverlay}>
              <Ionicons name="checkmark" size={96} color={Colors.income} />
            </View>
          ) : null}

          {isFailed ? (
            <View style={styles.failedOverlay}>
              <Ionicons name="close" size={96} color={Colors.expense} />
            </View>
          ) : null}
        </View>

        {isScanning ? (
          <View style={styles.progressBarWrap}>
            <View style={[styles.progressBarFill, { width: `${scanProgress * 100}%` }]} />
            <Text style={styles.progressText}>{Math.round(scanProgress * 100)}%</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.instructions}>
        <Text style={[Typography.headingL, { color: Colors.white, textAlign: 'center' }]}>{title}</Text>
        <Text
          style={[Typography.bodyM, { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 8, paddingHorizontal: 24 }]}
        >
          {hint}
        </Text>

        {phase === 'positioning' ? (
          <PrimaryButton label="Bắt đầu quét" onPress={startScan} style={{ marginTop: Space.s24 }} />
        ) : null}

        {isFailed ? (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: Space.s24 }}>
            <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
              <Text style={[Typography.buttonM, { color: Colors.white }]}>Dùng mật khẩu</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Thử lại" onPress={retry} />
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
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
  frameWrap: { alignItems: 'center', marginTop: 16 },
  frame: {
    width: FRAME_W,
    height: FRAME_H,
    borderRadius: FRAME_W,
    overflow: 'hidden',
    borderWidth: 4,
    backgroundColor: '#1a1a22',
    position: 'relative',
  },
  sweepLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    shadowOpacity: 0.95,
    shadowRadius: 10,
    elevation: 14,
  },
  cornerBracket: { position: 'absolute', width: 24, height: 24 },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34,197,94,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  failedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(239,68,68,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarWrap: {
    width: FRAME_W,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 16,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressBarFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Colors.primary },
  progressText: { position: 'absolute', alignSelf: 'center', color: Colors.white, fontSize: 10, fontWeight: '700' },
  instructions: { flex: 1, justifyContent: 'flex-end', padding: 24, paddingBottom: Space.s40 },
  fullCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
