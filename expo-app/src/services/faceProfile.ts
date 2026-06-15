import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Hồ sơ khuôn mặt TỰ QUẢN của BudgetBee — HOÀN TOÀN TÁCH BIỆT với sinh trắc
 * học sẵn có của hệ điều hành (Face Unlock/Face ID). Đây là hệ "tự quét mặt
 * bằng camera của app, tự trích đặc điểm, tự đối chiếu" theo yêu cầu.
 *
 * TRẠNG THÁI HIỆN TẠI (Giai đoạn 1 — Quét & Lưu):
 *   - Lưu các khung hình khuôn mặt đã chụp (uri + ảnh thu nhỏ) + metadata.
 *   - `descriptor` để TRỐNG: đây là chỗ cắm tầng AI ở Giai đoạn 2 (ArcFace
 *     ONNX 512-d hoặc bộ trích đặc điểm mắt/mũi/miệng phía server). Xem
 *     KE_HOACH_KHUON_MAT.md. Khi có model, điền `descriptor` và dùng nó để
 *     đối chiếu ở màn đăng nhập.
 *
 * LƯU Ý: Đây CHƯA phải xác thực an toàn — chưa có model nhận dạng + chống giả
 * mạo. Không dùng để duyệt giao dịch tiền cho tới khi hoàn tất Giai đoạn 2–3.
 */

export interface FaceFrame {
  /** Đường dẫn file ảnh khung đã chụp trên thiết bị. */
  uri: string;
  /** Bước hướng dẫn lúc chụp: 'front' | 'left' | 'right' ... */
  step: string;
  capturedAt: number;
}

export interface FaceProfile {
  enrolledAt: number;
  frames: FaceFrame[];
  /**
   * Vector đặc điểm khuôn mặt (512-d ArcFace, hoặc 128-d dlib...).
   * Hiện để trống — sẽ điền khi tầng AI Giai đoạn 2 sẵn sàng.
   */
  descriptor: number[] | null;
  version: string;
}

const KEY = 'custom_face_profile_v1';
const VERSION = 'capture_only_v1';

export const faceProfile = {
  /** Lưu hồ sơ khuôn mặt sau khi quét xong các bước. */
  async save(frames: FaceFrame[], descriptor: number[] | null = null): Promise<void> {
    const profile: FaceProfile = {
      enrolledAt: Date.now(),
      frames,
      descriptor,
      version: VERSION,
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(profile));
  },

  async get(): Promise<FaceProfile | null> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.frames)) return parsed as FaceProfile;
      return null;
    } catch {
      return null;
    }
  },

  async isEnrolled(): Promise<boolean> {
    return (await this.get()) !== null;
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(KEY);
  },
};
