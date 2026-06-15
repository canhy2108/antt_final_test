import { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors, Typography, Space, Radius } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { faceProfile, FaceFrame } from '@/services/faceProfile';
import { haptic } from '@/utils/haptics';
import { useAuth } from '@/stores/auth';
import { biometricApi } from '@/api/biometric';

/**
 * Màn QUÉT MẶT THẬT bằng camera của app (expo-camera) — tách biệt hoàn toàn
 * với sinh trắc OS. Người dùng đưa mặt vào khung oval, chụp 3 góc có hướng dẫn,
 * rồi lưu các khung làm hồ sơ khuôn mặt.
 *
 * Đây là Giai đoạn 1 (Quét & Lưu). Tầng AI trích đặc điểm + đối chiếu là bước
 * sau — xem KE_HOACH_KHUON_MAT.md. Sau khi tầng AI sẵn sàng, ta tính descriptor
 * từ các khung này và lưu kèm để đăng nhập lần sau đối chiếu.
 */
type StepKey = 'front' | 'left' | 'right';

const STEPS: { key: StepKey; title: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'front', title: 'Nhìn thẳng vào camera', hint: 'Đưa khuôn mặt vào giữa khung oval, giữ yên', icon: 'happy-outline' },
  { key: 'left', title: 'Quay mặt sang TRÁI một chút', hint: 'Giữ khuôn mặt trong khung, xoay nhẹ sang trái', icon: 'arrow-back' },
  { key: 'right', title: 'Quay mặt sang PHẢI một chút', hint: 'Giữ khuôn mặt trong khung, xoay nhẹ sang phải', icon: 'arrow-forward' },
];

export default function FaceScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);

  const [stepIdx, setStepIdx] = useState(0);
  const [frames, setFrames] = useState<FaceFrame[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastShot, setLastShot] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // intent=login → sau khi quét mặt, hoàn tất đăng nhập bằng sinh trắc thiết bị.
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const isLogin = intent === 'login';
  const setUser = useAuth((s) => s.setUser);

  const step = STEPS[stepIdx];

  async function capture() {
    if (busy || !camRef.current) return;
    setBusy(true);
    haptic.light();
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 0.4, skipProcessing: true });
      if (!photo?.uri) {
        setBusy(false);
        return;
      }
      const frame: FaceFrame = { uri: photo.uri, step: step.key, capturedAt: Date.now() };
      const next = [...frames, frame];
      setFrames(next);
      setLastShot(photo.uri);
      haptic.success();

      if (stepIdx + 1 < STEPS.length) {
        setStepIdx(stepIdx + 1);
      } else if (isLogin) {
        // CHẾ ĐỘ ĐĂNG NHẬP: đã quét mặt (cổng hình ảnh) → xác thực thật bằng
        // sinh trắc của thiết bị để lấy token rồi vào app.
        setDone(true);
        try {
          const { user } = await biometricApi.loginByBiometric();
          setUser(user);
          haptic.success();
          setTimeout(() => router.replace('/(tabs)'), 600);
        } catch (e: any) {
          haptic.error();
          Alert.alert(
            'Cần xác nhận',
            e?.message ?? 'Chưa bật đăng nhập sinh trắc — hãy đăng nhập bằng mật khẩu.',
            [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
          );
        }
      } else {
        // CHẾ ĐỘ ĐĂNG KÝ: lưu hồ sơ khuôn mặt. descriptor=null (tầng AI làm sau).
        await faceProfile.save(next, null);
        setDone(true);
        setTimeout(() => router.back(), 1200);
      }
    } catch {
      haptic.error();
    } finally {
      setBusy(false);
    }
  }

  // ----- Chưa cấp quyền camera -----
  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onClose={() => router.back()} />
        <View style={styles.center}>
          <View style={styles.permIcon}>
            <Ionicons name="camera-outline" size={56} color={Colors.primary} />
          </View>
          <Text style={[Typography.headingL, styles.titleLight]}>Cần quyền camera</Text>
          <Text style={[Typography.bodyM, styles.hintLight]}>
            BudgetBee cần dùng camera trước để quét và lưu khuôn mặt của bạn.
          </Text>
          <View style={{ alignSelf: 'stretch', paddingHorizontal: 24, marginTop: 24 }}>
            <PrimaryButton label="Cho phép camera" onPress={requestPermission} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ----- Đã xong -----
  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <View style={[styles.permIcon, { borderColor: Colors.income }]}>
            <Ionicons name="checkmark" size={64} color={Colors.income} />
          </View>
          <Text style={[Typography.headingL, styles.titleLight]}>
            {isLogin ? 'Đã quét khuôn mặt' : 'Đã lưu khuôn mặt'}
          </Text>
          <Text style={[Typography.bodyM, styles.hintLight]}>
            {isLogin
              ? 'Đang xác nhận bằng sinh trắc thiết bị để vào ứng dụng…'
              : `Đã chụp ${frames.length} góc và lưu hồ sơ khuôn mặt trên thiết bị.`}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ----- Đang quét -----
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onClose={() => router.back()} />

      {/* Tiến độ các bước */}
      <View style={styles.progressRow}>
        {STEPS.map((s, i) => (
          <View
            key={s.key}
            style={[
              styles.progressDot,
              i < stepIdx && { backgroundColor: Colors.income },
              i === stepIdx && { backgroundColor: Colors.primary, width: 28 },
            ]}
          />
        ))}
      </View>

      <View style={styles.cameraWrap}>
        <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="front" />
        {/* Khung oval hướng dẫn đặt mặt */}
        <View style={styles.ovalGuide} pointerEvents="none" />
        {lastShot ? (
          <Image source={{ uri: lastShot }} style={styles.thumb} />
        ) : null}
      </View>

      <View style={styles.instructions}>
        <View style={styles.stepIconWrap}>
          <Ionicons name={step.icon} size={26} color={Colors.primaryDark} />
        </View>
        <Text style={[Typography.headingM, styles.titleLight]}>{step.title}</Text>
        <Text style={[Typography.bodyM, styles.hintLight]}>{step.hint}</Text>

        <View style={{ alignSelf: 'stretch', paddingHorizontal: 24, marginTop: 18 }}>
          <PrimaryButton
            label={busy ? 'Đang chụp…' : `Chụp góc ${stepIdx + 1}/${STEPS.length}`}
            onPress={capture}
            loading={busy}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onClose} hitSlop={12}>
        <Ionicons name="close" size={28} color={Colors.white} />
      </Pressable>
      <Text style={[Typography.headingM, { color: Colors.white }]}>Quét khuôn mặt</Text>
      <View style={{ width: 28 }} />
    </View>
  );
}

const OVAL_W = 220;
const OVAL_H = 290;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0B0F' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.pageHorizontal,
    paddingVertical: 12,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  titleLight: { color: Colors.white, textAlign: 'center', marginTop: 20 },
  hintLight: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 8 },
  permIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: 'rgba(189,232,62,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginVertical: 12 },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.25)' },
  cameraWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: Radius.l,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ovalGuide: {
    width: OVAL_W,
    height: OVAL_H,
    borderRadius: OVAL_W,
    borderWidth: 3,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  thumb: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  instructions: { alignItems: 'center', paddingBottom: Space.s24, paddingTop: 8 },
  stepIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(189,232,62,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
