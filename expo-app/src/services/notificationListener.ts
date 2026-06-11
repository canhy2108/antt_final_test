/**
 * Wrapper quanh `react-native-android-notification-listener`.
 *
 * RÀNG BUỘC KỸ THUẬT QUAN TRỌNG (đọc kỹ — ảnh hưởng kiến trúc):
 *
 *   1. Module này CHỈ chạy được trên Android Development Build (qua EAS
 *      Build hoặc `npx expo run:android`). KHÔNG chạy được trên Expo Go
 *      vì Expo Go không thể bao gồm các NotificationListenerService
 *      native do thư viện cung cấp.
 *
 *   2. iOS KHÔNG có API public nào cho phép app đọc thông báo của app
 *      khác — đây là chính sách bảo mật của Apple, không có workaround.
 *      Trên iOS chúng tôi luôn trả về `available: false` và UI ẩn toàn
 *      bộ luồng auto-import. User iOS sẽ phải nhập tay hoặc dùng tính
 *      năng OCR ảnh chụp SMS (chưa triển khai, ghi nhận trong roadmap).
 *
 *   3. Trên Android, user phải cấp quyền "Notification Access" thủ công
 *      trong `Settings → Apps & notifications → Special app access →
 *      Notification access`. Không có cách nào auto-cấp từ trong app
 *      (đây là yêu cầu của Android Security Model). Chúng tôi cung cấp
 *      `openSettings()` để deep-link vào đúng trang đó.
 *
 *   4. Notification Listener chạy trong nền (foreground service) →
 *      Google Play Store yêu cầu khai báo `permission.BIND_NOTIFICATION_LISTENER_SERVICE`
 *      trong AndroidManifest.xml và justify use-case khi publish.
 *      Xem app.json plugins config bên dưới.
 *
 * Mọi hàm trong file này đều safe-to-call trên iOS — chúng kiểm tra
 * platform và return giá trị "không khả dụng" thay vì crash.
 */

import { Platform, NativeEventEmitter, NativeModules } from 'react-native';
import { parseBankNotification, ParsedBankNotification } from './bankNotificationParser';

/** Lazy import — chỉ load native module trên Android. */
let RNAndroidNotificationListener: any = null;
let nativeEmitter: NativeEventEmitter | null = null;

if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-android-notification-listener');
    RNAndroidNotificationListener = mod?.default ?? mod;
    if (NativeModules.RNAndroidNotificationListener) {
      nativeEmitter = new NativeEventEmitter(NativeModules.RNAndroidNotificationListener);
    }
  } catch (err) {
    // Module chưa được link (Expo Go hoặc dev build chưa rebuild). KHÔNG
    // throw — chỉ log để dev biết. UI sẽ phát hiện qua `isAvailable()`.
    // eslint-disable-next-line no-console
    console.warn(
      '[notificationListener] react-native-android-notification-listener không khả dụng. ' +
        'Bạn đang chạy trên Expo Go? Tính năng auto-import giao dịch yêu cầu EAS Dev Build.',
      err,
    );
  }
}

export type PermissionState = 'authorized' | 'denied' | 'unknown';

export interface BankNotificationEvent {
  /** Title của notification (thường là tên bank hoặc tài khoản). */
  title: string;
  /** Body text — đây là phần được feed vào parser. */
  text: string;
  /** Package name của app gửi (com.VCB, vn.com.techcombank.bb.app...). */
  packageName: string;
  /** epoch ms khi notification đến. */
  timestamp: number;
}

type Handler = (event: BankNotificationEvent, parsed: ParsedBankNotification | null) => void;

const handlers = new Set<Handler>();
let subscription: { remove: () => void } | null = null;

export const notificationListener = {
  /** App có hỗ trợ tính năng này trên platform hiện tại không. */
  isAvailable(): boolean {
    if (Platform.OS !== 'android') return false;
    return RNAndroidNotificationListener !== null;
  },

  /** Lý do không khả dụng — để UI hiển thị giải thích. */
  unavailableReason(): string | null {
    if (Platform.OS === 'ios') {
      return 'iOS không cho phép app đọc thông báo của app khác. ' +
        'Tính năng này chỉ chạy được trên Android.';
    }
    if (Platform.OS === 'web') return 'Trình duyệt không hỗ trợ.';
    if (!RNAndroidNotificationListener) {
      return 'Bạn đang chạy trên Expo Go. Cần Development Build (EAS) ' +
        'để bật quyền đọc thông báo. Xem README.';
    }
    return null;
  },

  /** Lấy trạng thái quyền hiện tại. */
  async getPermissionStatus(): Promise<PermissionState> {
    if (!this.isAvailable()) return 'denied';
    try {
      const status = await RNAndroidNotificationListener.getPermissionStatus();
      if (status === 'authorized') return 'authorized';
      if (status === 'denied') return 'denied';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  },

  /**
   * Mở Android Settings → Notification access. KHÔNG thể auto-cấp; user
   * phải tự bật toggle "BudgetBee" rồi back về app.
   */
  async openSettings(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await RNAndroidNotificationListener.requestPermission();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Đăng ký 1 handler nhận event mỗi khi có thông báo bank đến. Handler
   * nhận cả raw event lẫn kết quả parse (có thể null nếu parser từ chối).
   * Trả về hàm unsubscribe.
   */
  subscribe(handler: Handler): () => void {
    handlers.add(handler);
    ensureSubscribed();
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0 && subscription) {
        subscription.remove();
        subscription = null;
      }
    };
  },
};

function ensureSubscribed() {
  if (subscription || !nativeEmitter) return;
  // Tên event do react-native-android-notification-listener emit. Nếu
  // version khác đổi tên (ví dụ "RNAndroidNotificationListener"), điều
  // chỉnh ở đây.
  subscription = nativeEmitter.addListener('notificationReceived', (raw: any) => {
    const event: BankNotificationEvent = {
      title: String(raw?.title ?? ''),
      text: String(raw?.text ?? raw?.bigText ?? ''),
      packageName: String(raw?.app ?? raw?.packageName ?? ''),
      timestamp: Date.now(),
    };
    // Ghép title + text trước khi parse — có ngân hàng đặt số tiền ở title,
    // mô tả ở body.
    const combined = `${event.title}\n${event.text}`.trim();
    const parsed = parseBankNotification(combined, { androidPackage: event.packageName });

    handlers.forEach((h) => {
      try {
        h(event, parsed);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[notificationListener] handler error', err);
      }
    });
  });
}
