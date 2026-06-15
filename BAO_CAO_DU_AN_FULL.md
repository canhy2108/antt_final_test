# BÁO CÁO DỰ ÁN: BudgetBee — Ứng dụng quản lý chi tiêu cá nhân

Môn: An ninh thông tin · Repo: `canhy2108/antt_final_test` (nhánh `Klinh`)
Ngày: 14/06/2026

---

## 1. Giới thiệu

**BudgetBee** là ứng dụng quản lý tài chính cá nhân (personal finance tracker) cho
phép người dùng ghi chép thu/chi, quản lý nhiều tài khoản tiền, lập ngân sách, đặt
mục tiêu tiết kiệm, theo dõi nợ/cho vay và nhận cảnh báo chi tiêu. **Ứng dụng KHÔNG
liên kết với ngân hàng** (không phải ví điện tử) — nó giúp người dùng tự quản lý
chi tiêu một cách hợp lý.

Vì là app tài chính cá nhân, "tài sản" cần bảo vệ chính là **dữ liệu tài chính riêng
tư** của người dùng, nên trọng tâm an ninh là **quyền riêng tư + kiểm soát truy cập +
bảo vệ dữ liệu**, thay vì "ủy quyền giao dịch" như app ngân hàng.

---

## 2. Kiến trúc & công nghệ

Dự án gồm **2 thành phần** trong cùng repo:

| Thành phần | Thư mục | Công nghệ |
|---|---|---|
| **Mobile app** (frontend) | `expo-app/` | React Native + Expo SDK 54, TypeScript, expo-router, Zustand |
| **API server** (backend) | `api/` | Laravel 10 (PHP 8.1), Sanctum (token auth), SQLite (demo) / MySQL |

Luồng tổng quát: App (điện thoại) ⇄ REST API (Laravel) ⇄ Database.

Thư viện đáng chú ý phía app: `expo-local-authentication` (sinh trắc), `expo-secure-store`
(lưu khóa an toàn), `expo-camera` (quét khuôn mặt), `react-native-gifted-charts` (biểu đồ),
`axios` (HTTP), `expo-crypto` (băm/CSPRNG).

---

## 3. Chức năng chính

- **Xác thực**: đăng ký + xác minh OTP qua email, đăng nhập email/mật khẩu, đăng nhập
  nhanh bằng **sinh trắc học** (vân tay/khuôn mặt), khóa ứng dụng bằng PIN, 2FA TOTP.
- **Tài khoản tiền**: tạo nhiều tài khoản (tiền mặt, thẻ, tiết kiệm…), đa tiền tệ.
- **Giao dịch**: thu / chi / chuyển khoản nội bộ, phân loại theo danh mục, tìm kiếm/lọc.
- **Danh mục**: cây danh mục cha–con riêng cho từng người dùng.
- **Ngân sách**: đặt hạn mức theo danh mục, theo dõi % đã chi.
- **Mục tiêu tiết kiệm**: đặt mục tiêu + ghi nhận các lần góp.
- **Nợ / cho vay**: theo dõi khoản cho vay/đi vay, lãi suất, thanh toán một phần.
- **Giao dịch định kỳ**: lương, tiền nhà, thuê bao… tự nhắc/tạo.
- **Khoản sắp chi**: nhắc các khoản lớn sắp đến hạn.
- **Báo cáo & biểu đồ**: tổng quan dòng tiền, phân tích chi tiêu.
- **Thông báo**: nhắc nhở + **cảnh báo chi tiêu bất thường** (mục 6).

---

## 4. Hệ thống bảo mật (trọng tâm)

### 4.1. Xác thực & quản lý phiên
- Mật khẩu băm bằng **Argon2id** (Laravel Hash), yêu cầu **tối thiểu 12 ký tự** và
  kiểm tra **không nằm trong danh sách lộ lọt** (HaveIBeenPwned).
- **OTP** sinh bằng CSPRNG (`random_int`), so khớp hằng thời gian (`hash_equals`),
  giới hạn số lần thử + số lần gửi, hết hạn ngắn; **lưu dưới dạng hash** trong DB.
- **Token**: access token ngắn hạn (1 giờ) + **refresh token xoay vòng** (rotation,
  phát hiện tái dùng); client tự gọi `/auth/refresh` khi 401.
- **Rate-limit** đăng nhập (5 lần/15 phút theo email+IP) + throttle toàn API.

### 4.2. Sinh trắc học (vân tay / khuôn mặt)
- Đăng nhập nhanh bằng sinh trắc của **hệ điều hành** (Secure Enclave/Keystore): token
  thiết bị (`bio_token`) chỉ lưu trong `secure-store` với `requireAuthentication`, gắn
  với (user, thiết bị, loại); server chỉ lưu **SHA-256** của token.
- Có **camera quét khuôn mặt** trong app (giai đoạn 1: quét & lưu) — bước đối chiếu AI
  là hướng phát triển (xem `KE_HOACH_KHUON_MAT.md`).
- **PIN**: băm salted + **khóa lũy tiến chống dò** (5 lần sai → tạm khóa, tăng dần).

### 4.3. Bảo vệ dữ liệu & quyền riêng tư
- Chế độ riêng tư (ẩn số dư), khóa app khi để nền 30 giây, chống chụp màn hình
  (FLAG_SECURE), security headers OWASP (HSTS, CSP, X-Frame-Options…), audit log.
- API key (cho tích hợp ngoài) lưu **hash**; ràng buộc theo thiết bị (device fingerprint).

### 4.4. Mô hình kiểm soát truy cập
- Mọi truy vấn dữ liệu lọc theo `user_id`; danh mục/ngân sách/tài khoản gắn chủ sở hữu.

---

## 5. Công việc đã thực hiện (rà soát, sửa lỗi & nâng cấp)

Trong quá trình hoàn thiện, đã thực hiện một loạt audit và sửa lỗi:

**Sửa lỗi nghiêm trọng:**
- **Build Android hỏng** — thiếu `res/xml/secure_store_*.xml` → đã tạo.
- **Mạng/HTTP bị chặn** — thêm `network_security_config`, sửa fallback API URL
  (`localhost`→`10.0.2.2` cho emulator, cảnh báo khi build production thiếu cấu hình).
- **"Network error" khi thêm giao dịch** — gốc rễ: hook AI gọi `python3` với đường dẫn
  Docker, không timeout, làm treo request 188 giây; server `artisan serve` đơn luồng nên
  treo toàn bộ. → **Tắt AI mặc định + timeout + bắt lỗi + đường dẫn đúng**.
- **Trùng/ghi đè khuôn mặt–vân tay** — đăng ký explicit kind, hợp nhất về 1 credential.

**Tăng cường bảo mật:**
- Gỡ code lưu `bio_token` không bảo vệ (lỗ hổng replay).
- **Khóa chống dò PIN** (lockout lũy tiến).
- **Hash OTP** khi lưu.
- **Token TTL ngắn + refresh rotation** (client tự refresh).
- Bỏ `Math.random()` trong device fingerprint, dùng CSPRNG.
- `.gitignore` + gỡ file dump SQL khỏi repo.

**Tính năng mới:**
- Trang đăng ký vân tay (công tắc + deep-link OS + tự về trang chủ).
- Camera quét khuôn mặt + đăng nhập bằng khuôn mặt.
- **Cảnh báo chi tiêu bất thường** (mục 6).

---

## 6. Tính năng nổi bật: Cảnh báo chi tiêu bất thường

Phát hiện và cảnh báo các bất thường trong chi tiêu — vừa hữu ích, vừa thể hiện kiến
thức an ninh/ML.

**Thuật toán** (`app/Services/SpendingAnomalyService.php`):
1. **Giao dịch ngoại lai** trong từng danh mục dùng **Modified Z-Score (median/MAD)**:
   `modz = 0.6745·(x − median)/MAD`, cờ khi `modz > 3.5`. MAD bền với chính outlier
   nên một khoản lớn không tự "che" mình (ưu điểm so với z-score thường).
2. **Tăng đột biến tổng chi tháng** so với trung bình các tháng trước (> 1.5 lần).
3. **Vượt ngân sách** danh mục trong tháng.

**API**: `GET /api/insights`, `POST /api/insights/scan`, `POST /api/insights/{id}/dismiss`.
Kết quả hiển thị dưới dạng **thông báo** trong app.

---

## 7. Dữ liệu test & cách chạy

**Chạy backend** (thư mục `api/`):
```
composer install
php artisan migrate --seed                  # tạo loại tài khoản + tiền tệ
php artisan db:seed --class=TestFullAccountSeeder
php artisan serve --host=0.0.0.0 --port=8000
```

**Chạy app** (thư mục `expo-app/`):
```
npm install
npx expo start -c                            # -c để xóa cache Metro
```
Quét QR bằng Expo Go (cùng Wi-Fi với máy chạy backend). Lưu ý: sinh trắc học
`requireAuthentication` và một số native module chỉ chạy đầy đủ trên **development build**.

**Tài khoản test** (mật khẩu: `Demo@Bee2026`):
- `demo@budgetbee.com` — đầy đủ mọi tính năng.
- `an@budgetbee.com`, `binh@budgetbee.com`, `cuong@budgetbee.com` — 3 hồ sơ đa dạng.

---

## 8. Hạn chế & hướng phát triển

**Hạn chế hiện tại:**
- Camera quét khuôn mặt mới ở mức **quét & lưu**, chưa có model đối chiếu + chống giả
  mạo (liveness) → chưa dùng làm xác thực danh tính an toàn.
- Gợi ý danh mục bằng AI (python) **tắt mặc định** (cần cài Python + chạy nền).
- `AttestationController` (Play Integrity / App Attest) mới là khung.

**Hướng nâng cấp (đề xuất cho đồ án):**
- **Mã hóa đầu-cuối (E2EE) / Zero-Knowledge**: server chỉ lưu ciphertext — điểm nhấn an
  ninh mạnh và là điểm khác biệt sản phẩm.
- **Tự đọc thông báo ngân hàng** để gợi ý ghi giao dịch (giảm công gõ tay).
- **PIN chống ép buộc (duress/decoy)**.
- Hoàn thiện **liveness** cho khuôn mặt (chuẩn ISO/IEC 30107-3) — xem `KE_HOACH_KHUON_MAT.md`.
- Nâng băm PIN lên Argon2/PBKDF2; ID thiết bị thật (expo-application); TLS pinning.

Chi tiết lộ trình: xem `KE_HOACH_CAI_THIEN.md` (an ninh) và `KE_HOACH_KHUON_MAT.md` (khuôn mặt).

---

## 9. Phụ lục

**Tài liệu kèm theo trong repo:**
- `BAO_CAO_SUA_LOI_2026-06-14.md` — báo cáo rà soát & sửa lỗi.
- `KE_HOACH_CAI_THIEN.md` — phương án cải thiện an ninh (theo mức ưu tiên).
- `KE_HOACH_KHUON_MAT.md` — thiết kế kỹ thuật nhận diện khuôn mặt.

**Các endpoint chính** (auth qua Sanctum token):
`/login`, `/register`, `/verify-otp`, `/auth/refresh`, `/biometric/*`,
`/account/*`, `/records`, `/budgets`, `/savings-goals`, `/debts-loans`,
`/recurring`, `/insights`, `/notifications`.

---

*Báo cáo này tổng hợp kiến trúc, chức năng, thiết kế an ninh và toàn bộ công việc rà
soát/sửa lỗi/nâng cấp đã thực hiện trên dự án BudgetBee.*
