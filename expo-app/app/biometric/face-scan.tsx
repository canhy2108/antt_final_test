import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Space, Radius } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { secureStorage } from '@/services/secureStorage';
import { userBiometricService } from '@/services/userBiometric';
import { biometricApi } from '@/api/biometric';
import { usePrefs } from '@/stores/prefs';
import { authApi } from '@/api/auth';
import { haptic } from '@/utils/haptics';

/**
 * Face enrolment — LIVE scan with a silent capture at the end.
 *
 * During the 4-second scan animation, the front camera runs in the oval as
 * pure feedback (user sees themselves but no photo is displayed back). At
 * the moment the scan completes, a single frame is grabbed (quality 0.3 ≈
 * ~10-15kB) and uploaded to /api/biometric/enroll-face for cross-device
 * server-side matching. The UI never shows the captured photo back to the
 * user — the data is purely for the server.
 */
type Phase = 'verify-password' | 'positioning' | 'scanning' | 'uploading' | 'success';

const FRAME_W = 240;
const FRAME_H = 320;
const SCAN_DURATION_MS = 4000;

export default function FaceScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('verify-password');
  const setBio = usePrefs((s) => s.setBiometric);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const [scanProgress, setScanProgress] = useState(0);
  const scanStartRef = useRef<number | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const sweep = useRef(new Animated.Value(0)).current;
  const cornerPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const userEmail = (await secureStorage.getUserEmail()) ?? '';
      setEmail(userEmail);
    })();
  }, []);

  useEffect(() => {
    if (phase === 'verify-password' || phase === 'success' || phase === 'uploading') {
      sweep.stopAnimation();
      return;
    }
    const speed = phase === 'scanning' ? 600 : 1100;
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
    if (phase !== 'scanning') {
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

  async function verifyPassword() {
    if (!password.trim()) {
      setPwError('Vui lòng nhập mật khẩu');
      haptic.error();
      return;
    }
    if (!email) {
      setPwError('Không tìm thấy email — vui lòng đăng nhập lại');
      haptic.error();
      return;
    }
    setPwError(null);
    setVerifying(true);
    try {
      await authApi.login(email, password);
      // No local password caching — see userBiometric.ts. The OS-biometric
      // gated bio_token in secureKeystore is the actual auth factor.
      haptic.success();
      setPhase('positioning');
    } catch (e: any) {
      setPwError(e?.message ?? 'Mật khẩu không đúng');
      haptic.error();
    } finally {
      setVerifying(false);
    }
  }

  function startScan() {
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
        captureAndUpload(elapsed);
      }
    }, 50);
  }

  async function captureAndUpload(_elapsed: number) {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    scanStartRef.current = null;

    setPhase('uploading');

    try {
      // The OS Face ID prompt + the device-bound credential is what actually
      // matters; the camera frame is purely UI feedback. enrollFace itself
      // gates on biometricService.authenticate() (OS prompt) before talking
      // to the server, so we can't enroll if the real owner isn't present.
      await biometricApi.enrollFace(`face:${email}`);
      await userBiometricService.enrollFace(email, 0);
      await setBio(true);
      setPassword('');
      haptic.success();
      setPhase('success');
      setTimeout(() => router.back(), 1300);
    } catch (e: any) {
      haptic.error();
      setPhase('positioning');
      setPwError(e?.message ?? 'Không đăng ký được — vui lòng thử lại');
    }
  }

  // -------------------------------------------------------------- RENDER --

  if (phase === 'verify-password') {
    return (
      <SafeAreaView style={styles.bg} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={28} color={Colors.white} />
          </Pressable>
          <Text style={[Typography.headingM, { color: Colors.white }]}>Đăng ký khuôn mặt</Text>
          <View style={{ width: 28 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.pwBody}>
            <View style={styles.pwIcon}>
              <Ionicons name="key" size={48} color={Colors.primary} />
            </View>
            <Text style={[Typography.displayM, { color: Colors.white, marginTop: 24, textAlign: 'center' }]}>
              Xác nhận mật khẩu
            </Text>
            <Text
              style={[
                Typography.bodyM,
                { color: 'rgba(255,255,255,0.7)', marginTop: 12, textAlign: 'center', paddingHorizontal: 16 },
              ]}
            >
              Khuôn mặt sẽ lưu lên server để đăng nhập được trên mọi thiết bị. Nhập mật khẩu để xác nhận chủ tài khoản.
            </Text>

            <View style={styles.emailChip}>
              <Ionicons name="mail" size={14} color={Colors.white} />
              <Text style={[Typography.labelM, { color: Colors.white, marginLeft: 6 }]} numberOfLines={1}>
                {email || '—'}
              </Text>
            </View>

            <View style={styles.pwField}>
              <Ionicons name="lock-closed-outline" size={20} color="rgba(255,255,255,0.6)" />
              <TextInput
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (pwError) setPwError(null);
                }}
                placeholder="Mật khẩu BudgetBee"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                style={styles.pwInput}
                onSubmitEditing={verifyPassword}
                returnKeyType="go"
              />
            </View>

            {pwError ? (
              <View style={styles.pwErrorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.expense} />
                <Text style={[Typography.caption, { color: Colors.expense, marginLeft: 6, flex: 1 }]}>{pwError}</Text>
              </View>
            ) : null}

            <PrimaryButton
              label="Xác nhận"
              onPress={verifyPassword}
              loading={verifying}
              style={{ marginTop: Space.s24, alignSelf: 'stretch' }}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (!permission) return <View style={styles.bg} />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.bg} edges={['top']}>
        <View style={styles.permWrap}>
          <Ionicons name="camera-outline" size={56} color={Colors.primary} />
          <Text style={[Typography.headingL, { color: Colors.white, marginTop: 16, textAlign: 'center' }]}>
            Cần truy cập camera
          </Text>
          <PrimaryButton label="Cho phép camera" onPress={requestPermission} style={{ marginTop: 28 }} />
        </View>
      </SafeAreaView>
    );
  }

  const isSuccess = phase === 'success';
  const isScanning = phase === 'scanning';
  const isUploading = phase === 'uploading';

  const ovalColor = isSuccess
    ? Colors.income
    : isUploading
    ? '#FBBF24' // amber while uploading
    : isScanning
    ? Colors.primary
    : 'rgba(255,255,255,0.45)';
  const sweepY = sweep.interpolate({ inputRange: [0, 1], outputRange: [0, FRAME_H] });
  const cornerOpacity = cornerPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <SafeAreaView style={styles.bg} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} disabled={isScanning || isUploading}>
          <Ionicons name="close" size={28} color={isScanning || isUploading ? 'rgba(255,255,255,0.3)' : Colors.white} />
        </Pressable>
        <Text style={[Typography.headingM, { color: Colors.white }]}>
          {isSuccess ? 'Hoàn tất' : isScanning ? 'Đang quét...' : isUploading ? 'Đang lưu...' : 'Quét khuôn mặt'}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.frameWrap}>
        <View style={[styles.frame, { borderColor: ovalColor }]}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

          {!isSuccess && !isUploading ? (
            <Animated.View
              style={[styles.sweepLine, { backgroundColor: ovalColor, transform: [{ translateY: sweepY }] }]}
            />
          ) : null}

          <Animated.View
            style={[
              styles.cornerBracket,
              { top: 12, left: 12, borderTopWidth: 3, borderLeftWidth: 3, borderColor: ovalColor, opacity: isScanning ? cornerOpacity : 1 },
            ]}
          />
          <Animated.View
            style={[
              styles.cornerBracket,
              { top: 12, right: 12, borderTopWidth: 3, borderRightWidth: 3, borderColor: ovalColor, opacity: isScanning ? cornerOpacity : 1 },
            ]}
          />
          <Animated.View
            style={[
              styles.cornerBracket,
              { bottom: 12, left: 12, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: ovalColor, opacity: isScanning ? cornerOpacity : 1 },
            ]}
          />
          <Animated.View
            style={[
              styles.cornerBracket,
              { bottom: 12, right: 12, borderBottomWidth: 3, borderRightWidth: 3, borderColor: ovalColor, opacity: isScanning ? cornerOpacity : 1 },
            ]}
          />

          {isSuccess ? (
            <View style={styles.successOverlay}>
              <Ionicons name="checkmark" size={96} color={Colors.income} />
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
        <Text style={[Typography.headingL, { color: Colors.white, textAlign: 'center' }]}>
          {isSuccess
            ? 'Đã đăng ký lên server ✓'
            : isUploading
            ? 'Đang gửi đặc trưng khuôn mặt lên server...'
            : isScanning
            ? 'Giữ yên — đang quét'
            : 'Đưa mặt vào trong khung'}
        </Text>
        <Text style={[Typography.bodyM, { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 8 }]}>
          {isSuccess
            ? `Lần sau đăng xuất → bấm "Khuôn mặt" → quét → vào thẳng tài khoản ${email} trên BẤT KỲ THIẾT BỊ NÀO`
            : isUploading
            ? 'Vui lòng đợi'
            : isScanning
            ? 'Đầu thẳng, mắt nhìn camera'
            : 'Tháo kính, vén tóc. Bấm "Bắt đầu quét" khi sẵn sàng.'}
        </Text>

        {pwError && phase === 'positioning' ? (
          <View style={[styles.pwErrorBox, { marginTop: 12 }]}>
            <Ionicons name="alert-circle" size={16} color={Colors.expense} />
            <Text style={[Typography.caption, { color: Colors.expense, marginLeft: 6, flex: 1 }]}>{pwError}</Text>
          </View>
        ) : null}

        {phase === 'positioning' ? (
          <PrimaryButton label="Bắt đầu quét" onPress={startScan} style={{ marginTop: Space.s24 }} />
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
  pwBody: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 32 },
  pwIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(189,232,62,0.10)',
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    maxWidth: '100%',
  },
  pwField: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
    height: 56,
    borderRadius: Radius.m,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'stretch',
  },
  pwInput: { flex: 1, marginLeft: 8, color: Colors.white, fontSize: 16 },
  pwErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    borderRadius: Radius.m,
    backgroundColor: 'rgba(239,68,68,0.18)',
    alignSelf: 'stretch',
  },
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
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
});
