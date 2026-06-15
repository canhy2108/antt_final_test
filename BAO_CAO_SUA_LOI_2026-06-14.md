# BudgetBee — Báo cáo rà soát & sửa lỗi (14/06/2026)

Tập trung theo ưu tiên: **sinh trắc học → mạng → bảo mật → tính năng**.

Kết luận tổng quát: codebase **chất lượng cao**, TypeScript biên dịch sạch, bug "quét 2
lần" đã được xử lý từ trước, server-side biometric/OTP rất chắc. Phần lớn cảm giác "lỗi
sinh trắc / bảo mật" đến từ **môi trường chạy và cấu hình build**, không phải logic.

---

## 1. Đã sửa trong lần này

### 1.1. (NGHIÊM TRỌNG) Build Android thất bại — thiếu file XML
`AndroidManifest.xml` trỏ tới `@xml/secure_store_backup_rules` và
`@xml/secure_store_data_extraction_rules`, nhưng 2 file này **không tồn tại** trong repo →
`expo run:android` / gradle báo lỗi link resource và **không build được**.
- Đã tạo: `android/app/src/main/res/xml/secure_store_backup_rules.xml`
- Đã tạo: `android/app/src/main/res/xml/secure_store_data_extraction_rules.xml`
- Nội dung: loại trừ kho SecureStore khỏi cloud backup (đúng chuẩn bảo mật).

### 1.2. (GỐC RỄ của lỗi "mạng" + "sinh trắc fail") HTTP bị chặn
App gọi backend qua `http://<IP-LAN>:8000`. Android 9+ **chặn cleartext HTTP mặc định**,
nên trên build thật mọi request (đăng nhập, sinh trắc, đồng bộ) bị chặn → người dùng tưởng
"lỗi sinh trắc học" dù vân tay đúng. Lỗi mạng và lỗi biometric thực chất là **một**.
- Đã tạo `android/app/src/main/res/xml/network_security_config.xml` (cho phép cleartext khi
  test LAN; có ghi chú đổi sang HTTPS khi lên production).
- Đã thêm `android:networkSecurityConfig` vào `<application>` trong Manifest.

### 1.3. Fallback API URL sai trên thiết bị/emulator
`src/api/client.ts` khi không dò được Metro thì rơi về `http://localhost:8000` — sai vì
trên máy thật/emulator `localhost` là chính điện thoại, không phải PC backend.
- Ưu tiên lại thứ tự: env → **Metro auto-detect** (dev đổi Wi-Fi vẫn chạy) → `extra.apiUrl`
  → fallback theo nền tảng.
- Android emulator dùng `10.0.2.2`; build production thiếu cấu hình sẽ in cảnh báo rõ ràng
  thay vì lỗi âm thầm.

### 1.4. (Bảo mật) Gỡ code lưu bio_token KHÔNG bảo vệ
`src/services/secureStorage.ts` còn `saveBioCredential/getBioCredential/clearBioCredential`
(v2) ghi `bio_token` vào SecureStore **không gắn `requireAuthentication`** — lỗ hổng
replay token tiềm ẩn. Đây là code chết (không caller thật), đã gỡ hoàn toàn; luồng thật
chỉ dùng `secureKeystore` (có khóa sinh trắc trên mỗi lần đọc).

---

## 2. Quan trọng: Sinh trắc học KHÔNG chạy trong Expo Go

Đây gần như chắc chắn là lý do chính khiến biometric "bất tiện, nhiều lỗi".
`expo-secure-store` với `requireAuthentication: true` (khóa bio_token sau vân tay/khuôn mặt)
và các native module **chỉ hoạt động trong development build / production build**, KHÔNG
hoạt động khi quét QR bằng Expo Go.

**Cách chạy đúng:** `npx expo run:android` (cần Android Studio) hoặc EAS dev build
(`eas build --profile development`). Sau khi cài bản build này lên máy, sinh trắc học mới
chạy thật.

---

## 3. Kết quả audit bảo mật (server Laravel)

Tổng thể **tốt**. Các điểm mạnh đã có sẵn:
- Biometric login: token 256-bit, chỉ lưu `sha256(token)`, ràng buộc (user, device,
  kind), so sánh constant-time `hash_equals`, rate-limit theo IP + thiết bị. Chắc chắn.
- OTP: sinh bằng `random_int` (CSPRNG), `hash_equals`, giới hạn số lần thử + số lần gửi,
  hết hạn ngắn. Chắc chắn.
- Mật khẩu: `Hash::make` (bcrypt). Query dùng binding tham số — không thấy SQL injection.
- `.env` không bị commit vào git (đã kiểm tra).

Khuyến nghị (mức thấp, không khẩn):
- **OTP lưu plaintext trong DB** — cân nhắc hash khi lưu (dù ngắn hạn & dùng một lần).
- **Đổi `MAIL_PASSWORD`** trong `api/.env` — giá trị thật đang hiện diện; xoay khóa cho an
  toàn và đảm bảo không bao giờ commit.
- **`APP_DEBUG=true`** chỉ dùng local; production phải đặt `false` (tránh lộ stack trace).
- **Phase B** (`biometricKeysApi` + `src/native/BiometricNative.ts`) đã viết nhưng native
  module chưa cài → đang "ngủ" (mọi lời gọi sẽ throw). Hiện không screen nào gọi nên không
  ảnh hưởng; nên hoàn thiện hoặc gỡ để tránh nhầm lẫn.

---

## 4. Lỗi tính năng

Quét toàn bộ màn hình (giao dịch, ngân sách, tiết kiệm, nợ, định kỳ, thiết bị…): **không
phát hiện marker TODO/FIXME/"chưa làm" thực sự**, không màn hình nào dùng mock data. Phần
tính năng ở trạng thái hoàn thiện. Cần kiểm thử thực tế trên dev build để lộ bug runtime
(nếu có) — khuyến nghị test sau khi áp dụng mục 1 & 2.

---

## 5. Việc nên làm tiếp (đề xuất ưu tiên)

1. Build dev build (`npx expo run:android`) và test lại đăng nhập sinh trắc đầu–cuối.
2. Đặt `EXPO_PUBLIC_API_URL` hoặc `expo.extra.apiUrl` khi build preview/production.
3. Xoay `MAIL_PASSWORD`; đặt `APP_DEBUG=false` cho production.
4. Quyết định số phận Phase B (hoàn thiện native module hoặc gỡ).
