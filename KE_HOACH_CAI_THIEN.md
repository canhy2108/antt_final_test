# BudgetBee — Báo cáo quét & phương án cải thiện

Ngày: 14/06/2026 · Phạm vi: app Expo (`expo-app/`) + API Laravel (`api/`)
Bối cảnh: bản demo, còn nhiều lỗ hổng và chưa hoàn thiện.

---

## A. Tóm tắt điều hành

Nền tảng **khá tốt cho một bản demo**: kiến trúc rõ, có audit log, rate-limit
đăng nhập/OTP, security headers OWASP, biometric server-side dùng token băm.
Tuy nhiên còn nhiều điểm **chưa đạt chuẩn cho một app tài chính thật**, tập
trung ở: **bảo vệ PIN, ràng buộc thiết bị, vòng đời token, dữ liệu trong repo,
và phần khuôn mặt chưa có engine thật**.

Bảng mức độ ưu tiên (chi tiết ở mục B & C):

| # | Vấn đề | Loại | Mức |
|---|---|---|---|
| 1 | PIN băm SHA-256 nhanh + không khóa sau N lần sai | Bảo mật | **Cao** |
| 2 | Device fingerprint = ID ngẫu nhiên/lần cài (Math.random fallback) | Bảo mật | **Cao** |
| 3 | Khuôn mặt: chưa có engine nhận dạng + chống giả mạo | Bảo mật/SP | **Cao** |
| 4 | Token truy cập 30 ngày, scope `*`, chưa xoay refresh | Bảo mật | Trung bình |
| 5 | File backup `.sql` bị commit; thói quen dump DB vào repo | Bảo mật | Trung bình |
| 6 | OTP lưu plaintext trong DB | Bảo mật | Trung bình |
| 7 | Laravel 10 / Sanctum 3 (cũ); chưa quét phụ thuộc | Bảo mật | Trung bình |
| 8 | Chưa pin chứng chỉ (TLS pinning) / phát hiện root-jailbreak | Bảo mật | Trung bình |
| 9 | `APP_DEBUG=true`, `MAIL_PASSWORD` lộ trong .env local | Bảo mật | Trung bình |
| 10 | Phụ thuộc mạng hoàn toàn, không có chế độ offline | Sản phẩm | Trung bình |
| 11 | Mobile chưa có test, chưa có crash reporting | Sản phẩm | Trung bình |
| 12 | Biometric OS chỉ chứng "có người có vân tay", không phải chủ tài khoản | Bảo mật | Thấp–TB |

> Các mục đã được xử lý trong phiên làm việc trước xem **Phụ lục D**.

---

## B. Hệ thống bảo mật — lỗ hổng & cách khắc phục

### B1. (CAO) Bảo vệ mã PIN yếu
- **Hiện trạng:** `pinCrypto.ts` băm PIN bằng **SHA-256 có salt** (`v1:salt:hash`).
  Màn khóa (`biometric-lock.tsx`) **không giới hạn số lần nhập sai PIN**.
- **Rủi ro:** PIN chỉ 6 chữ số = 1.000.000 tổ hợp. SHA-256 rất nhanh → nếu kẻ
  tấn công lấy được hash (root/dump), **dò hết trong mili-giây** (salt chỉ chặn
  rainbow table, không chặn brute-force). Online thì thử không giới hạn lần.
- **Khắc phục:**
  1. Đổi sang **KDF chậm**: PBKDF2 (≥100k vòng) / scrypt / **Argon2id**.
  2. **Khóa lũy tiến** sau N lần sai (vd 5 lần → chờ 30s, tăng dần; 10 lần →
     buộc đăng nhập lại bằng mật khẩu+OTP).
  3. Cân nhắc gắn kiểm tra PIN vào khóa **Keystore phần cứng** + xóa dữ liệu
     sau quá nhiều lần sai.

### B2. (CAO) Ràng buộc thiết bị yếu
- **Hiện trạng:** `deviceFingerprint.ts` sinh **giá trị ngẫu nhiên 128-bit một
  lần mỗi lần cài**, fallback dùng `Math.random()` (không phải CSPRNG).
- **Rủi ro:** Đây là "ràng buộc theo lần cài", không phải theo thiết bị thật —
  cài lại là đổi ID; nếu sao chép được storage thì giả mạo được "thiết bị".
  `Math.random()` có thể đoán được.
- **Khắc phục:** Dùng định danh thiết bị nền tảng (Android `ANDROID_ID` /
  iOS `identifierForVendor` qua `expo-application`), kết hợp khóa **gắn phần
  cứng** trong Keystore/Secure Enclave (Phase B đã phác — xem B3 của báo cáo
  trước). Luôn dùng CSPRNG (`expo-crypto`), bỏ fallback `Math.random()`.

### B3. (CAO) Khuôn mặt chưa có engine thật
- **Hiện trạng:** Bảng `face_profiles` (512-d) là khung trống; chưa có model
  embedding, chưa có chống giả mạo (liveness). Cơ chế match cũ đã bị gỡ vì là
  lỗ hổng bypass.
- **Rủi ro:** Nếu bật đăng nhập mặt mà thiếu liveness → **mở khóa bằng 1 tấm ảnh**.
- **Khắc phục:** Theo lộ trình trong `KE_HOACH_KHUON_MAT.md` — ArcFace ONNX
  512-d trên thiết bị, liveness (active → passive theo ISO/IEC 30107-3), API
  `face/enroll|verify`. **Không** dùng mặt để duyệt tiền cho tới khi qua kiểm
  thử PAD.

### B4. (TB) Vòng đời token
- **Hiện trạng:** `createToken(..., now()->addDays(30))` với abilities `['*']`.
  Có `RefreshTokenController` nhưng access token vẫn sống 30 ngày, scope toàn quyền.
- **Khắc phục:** Rút ngắn access token (vd 15–60 phút) + **refresh token xoay
  vòng** (rotation, thu hồi khi nghi ngờ). Cấp **scope tối thiểu** thay vì `*`.
  Liên kết token với `device_id`, cho phép "đăng xuất thiết bị khác".

### B5. (TB) Dữ liệu nhạy cảm & cấu hình trong repo
- **Hiện trạng:** `api/backup_2026_05_26.sql` **được commit** (hiện rỗng) — thói
  quen dump DB vào repo rất rủi ro. `database.sqlite` (có dữ liệu thật) đang
  untracked — cần chắc chắn được gitignore.
- **Khắc phục:** Thêm `*.sql`, `*.sqlite`, `*.sqlite-*` vào `.gitignore`; **gỡ
  file dump khỏi lịch sử git** (`git filter-repo`/BFG) nếu từng chứa dữ liệu;
  không bao giờ commit dump DB.

### B6. (TB) OTP lưu plaintext
- **Hiện trạng:** cột `otps.code` lưu mã rõ. (Đã có CSPRNG, hash_equals, giới
  hạn lần thử/gửi — tốt.)
- **Khắc phục:** Lưu **hash** của OTP (vẫn so bằng hash_equals); mã ngắn hạn,
  một lần dùng.

### B7. (TB) Phụ thuộc cũ & chưa quét lỗ hổng
- **Hiện trạng:** `laravel/framework ^10.10`, `sanctum ^3.2`, PHP ^8.1 — đã cũ
  so với 2026; chưa thấy quy trình quét phụ thuộc.
- **Khắc phục:** Lên kế hoạch nâng Laravel/Sanctum theo bản LTS được hỗ trợ;
  thêm **quét phụ thuộc tự động** (Dependabot đã có cho repo; bổ sung Snyk/`composer
  audit` + `npm audit`). *Tôi có thể chạy quét Snyk cho cả PHP và JS nếu bạn muốn.*

### B8. (TB) Thiếu TLS pinning & phát hiện môi trường rủi ro
- **Hiện trạng:** App gọi HTTP khi dev (đã cấu hình), chưa có **certificate
  pinning**, chưa phát hiện **root/jailbreak**, chưa chống chụp màn hình ở mọi
  màn nhạy cảm (có `expo-screen-capture` ở mức app). `AttestationController` tồn
  tại nhưng cần kiểm tra đã dùng thực sự chưa.
- **Khắc phục:** Bắt buộc **HTTPS** ở production (docker/nginx đã có TLS); thêm
  **certificate/public-key pinning**; tích hợp **Play Integrity / App Attest**
  (đã có `AttestationController` để nối); cân nhắc phát hiện root/jailbreak.

### B9. (TB) Cấu hình production
- **Hiện trạng:** `.env` local có `APP_DEBUG=true` và `MAIL_PASSWORD` thật.
- **Khắc phục:** Production: `APP_DEBUG=false`, `APP_ENV=production`; **xoay
  `MAIL_PASSWORD`**; quản lý bí mật qua secret manager; bật HSTS (đã có header).

### B10. (Thấp–TB) Bản chất biometric OS
- **Hiện trạng:** Cửa sổ vân tay/Face của OS chỉ chứng "có một sinh trắc hợp lệ
  trên máy", không chứng đúng **chủ tài khoản**; máy nhiều người đăng ký vân tay
  thì ai cũng qua được.
- **Khắc phục:** Chấp nhận như "yếu tố tiện lợi", giữ **PIN+OTP cho thao tác
  nhạy cảm**; với mặt thì dùng nhận dạng chủ tài khoản (B3).

---

## C. Sản phẩm — phương án cải thiện

### C1. Kiến trúc & vận hành
- **Cấu hình môi trường rõ ràng:** tách dev/staging/prod; đặt `EXPO_PUBLIC_API_URL`
  / `expo.extra.apiUrl` cho từng build (đã vá fallback). Tài liệu hóa quy trình
  chạy (dev build vs Expo Go) để tránh nhầm "lỗi sinh trắc".
- **CI/CD:** server đã có workflow test + docker. Bổ sung **CI cho mobile**
  (typecheck, lint, EAS build) để chặn lỗi sớm (phiên này đã gặp file hỏng —
  CI typecheck sẽ bắt ngay).
- **Chế độ offline:** app phụ thuộc mạng hoàn toàn → cân nhắc **cache đọc** (số
  dư, giao dịch) để xem khi mất mạng; hàng đợi ghi khi online lại.

### C2. Chất lượng & độ tin cậy
- **Kiểm thử:** server có test; **mobile chưa có**. Thêm test cho luồng quan
  trọng (đăng nhập, sinh trắc, giao dịch) + smoke test E2E.
- **Crash/observability:** thêm **crash reporting** (Sentry) và logging có cấu
  trúc ở mobile; server đã có audit log — nối thêm cảnh báo bất thường.
- **Xử lý lỗi/UX mạng:** thông báo lỗi mạng rõ ràng, có retry; phân biệt "mất
  mạng" vs "sai thông tin" để người dùng không tưởng là lỗi sinh trắc.

### C3. Dữ liệu & tuân thủ (quan trọng với app tài chính)
- **Quyền riêng tư:** màn hình **đồng ý** thu thập sinh trắc; cho phép **xuất dữ
  liệu** và **xóa tài khoản/dữ liệu** (Nghị định 13/2023 VN; GDPR nếu có user EU).
- **Mã hóa:** dữ liệu nhạy cảm at-rest (vector mặt, token) được mã hóa; tối
  thiểu hóa dữ liệu (không lưu ảnh mặt nếu dùng kiến trúc hybrid).
- **Sao lưu an toàn:** backup DB mã hóa, ngoài repo, có vòng đời.

### C4. Hoàn thiện tính năng
- Phần khuôn mặt: hoàn tất theo lộ trình (B3).
- **Phase B** (khóa phần cứng `biometricKeys.ts`/`BiometricNative`) đang "ngủ" —
  hoàn thiện native module để có xác thực chống-replay thật, hoặc gỡ để bớt rối.
- Rà các màn phụ (kết nối ngân hàng, eKYC) xem có phần mô phỏng cần thay bằng
  luồng thật trước khi lên production.

---

## D. Phụ lục — đã xử lý trong phiên trước

- Sửa **lỗi build Android** (thiếu `res/xml/secure_store_*`).
- **Cấu hình mạng**: thêm `network_security_config` (HTTP bị Android chặn) +
  vá fallback API URL + cảnh báo khi build production thiếu cấu hình.
- **Gỡ code lưu `bio_token` không bảo vệ** (lỗ hổng replay tiềm ẩn).
- **Sửa lỗi trùng/ghi đè khuôn mặt–vân tay** (đăng ký explicit kind, hợp nhất
  về 1 credential).
- **Trang đăng ký vân tay** (toggle + deep-link OS + tự về trang chủ).
- **Camera quét mặt thật** (Giai đoạn 1: quét & lưu, tách khỏi sinh trắc OS).
- **Đơn giản hóa đăng nhập vân tay** (gọi thẳng OS, xóa màn trung gian).

---

## E. Lộ trình đề xuất

- **Ngắn hạn (1–2 tuần):** B1 (PIN KDF + khóa), B5 (gitignore + gỡ dump), B6
  (hash OTP), B9 (config prod + xoay secret), C1 (CI typecheck cho mobile),
  chạy quét phụ thuộc (B7).
- **Trung hạn (3–6 tuần):** B2 (device binding thật + Phase B), B4 (token TTL +
  refresh rotation), B8 (TLS pinning + attestation), C2 (test + Sentry),
  C3 (đồng ý/xóa dữ liệu).
- **Dài hạn:** B3 (khuôn mặt + liveness theo `KE_HOACH_KHUON_MAT.md`), C1 (offline),
  nâng cấp framework.

> Gợi ý: bắt đầu từ **B1, B5, B6, B9** — rủi ro cao/việc nhỏ, làm nhanh được ngay.
