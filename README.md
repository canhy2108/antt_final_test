# BudgetBee

Ứng dụng quản lý chi tiêu cá nhân. Gồm 2 phần:

- **`api/`** — Laravel 10 + Sanctum (REST API), DB SQLite (file, không cần server).
- **`expo-app/`** — React Native (Expo SDK 54), chạy bằng **dev client** (không chạy được trên Expo Go vì dùng native module: thông báo, sinh trắc học, auto-import).

> Hướng dẫn này mô tả **cách chạy thật trên máy dev** (Windows / LAN nội bộ), đúng theo cấu hình hiện tại của repo. Bản Docker/MySQL cũ đã không còn dùng.

---

## 0. Yêu cầu môi trường

| Thành phần | Phiên bản | Ghi chú |
| --- | --- | --- |
| **Node.js** | **20 LTS (bắt buộc)** | Node 22/24 gây lỗi `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` khi `expo start`. Phải dùng Node 20. |
| PHP | 8.1+ | Có sẵn extension `pdo_sqlite`, `mbstring`, `openssl`. |
| Composer | 2.x | |
| EAS CLI | mới nhất | `npm i -g eas-cli` — để build dev client APK. |
| Thiết bị Android | thật hoặc emulator | Một số tính năng (auto-import giao dịch từ thông báo) **chỉ chạy trên Android**. |

Kiểm tra Node:

```bash
node -v   # phải là v20.x
```

---

## 1. Backend (`api/`)

### 1.1. Cài đặt

```bash
cd api
composer install
cp .env.example .env          # nếu chưa có .env
php artisan key:generate
```

### 1.2. Cấu hình `.env`

DB dùng **SQLite** (đường dẫn tuyệt đối tới file `.sqlite`):

```env
DB_CONNECTION=sqlite
DB_DATABASE=C:/Users/ADMIN/BudgetBee/api/database/database.sqlite
```

Tạo file DB nếu chưa có rồi chạy migration:

```bash
# Windows (PowerShell):  New-Item api/database/database.sqlite
# git-bash / *nix:       touch api/database/database.sqlite
php artisan migrate
```

### 1.3. Gửi email OTP / reset qua Brevo (SMTP relay)

OTP và magic-link đặt lại mật khẩu cần gửi email. Repo dùng **Brevo SMTP relay** (miễn phí 300 email/ngày). Trong `.env`:

```env
MAIL_MAILER=smtp
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_ENCRYPTION=tls
MAIL_USERNAME=xxxxxxx@smtp-brevo.com      # SMTP login Brevo (KHÔNG phải email của bạn)
MAIL_PASSWORD=__SMTP_KEY_BREVO__          # SMTP key / Master Password — BÍ MẬT, tự dán, đừng commit
MAIL_FROM_ADDRESS=ban-da-verify@vidu.com  # phải là sender đã verify trong Brevo
MAIL_FROM_NAME="BudgetBee"
```

> **Lưu ý bảo mật**
> - `.env` đã được `.gitignore` — **không bao giờ commit** file này.
> - Lấy `MAIL_USERNAME` / `MAIL_PASSWORD` ở Brevo → **SMTP & API → SMTP**. `MAIL_PASSWORD` là **SMTP key**, không phải mật khẩu tài khoản.
> - Brevo có tính năng **Authorized IPs**. Nếu gửi mail báo lỗi `525 5.7.1 Unauthorized IP address`, vào Brevo → **Security → Authorized IPs** và thêm IP công cộng của máy đang gửi (không phải lỗi sai key/sender/port).

Sau khi sửa `.env`, luôn clear cache config:

```bash
php artisan config:clear
```

### 1.4. Chạy server (cho thiết bị trong LAN truy cập được)

```bash
php artisan serve --host=0.0.0.0 --port=8000
```

`--host=0.0.0.0` để điện thoại Android trong cùng Wi-Fi gọi được API qua **IP LAN** của máy (ví dụ `http://192.168.1.10:8000`), không chỉ `localhost`.

### 1.5. Kiểm tra nhanh

```bash
php artisan migrate:status   # các migration đều "Ran"
php -l app/Services/OtpService.php   # No syntax errors
```

---

## 2. Mobile app (`expo-app/`)

### 2.1. Cài đặt

```bash
cd expo-app
npm install
```

### 2.2. Trỏ app về API trong LAN

Client tự dò thứ tự sau (xem `src/api/client.ts`):

1. Biến môi trường `EXPO_PUBLIC_API_URL`
2. `app.json` → `extra.apiUrl`
3. Tự suy ra từ IP máy chạy Metro (`hostUri`) — **mặc định dùng IP LAN**
4. Fallback `http://localhost:8000/api`

Cách đơn giản nhất: đặt IP LAN của máy backend (cùng IP đã `php artisan serve --host=0.0.0.0`):

```bash
# ví dụ máy backend là 192.168.1.10
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000/api npx expo start --dev-client
```

> Lấy IP LAN: `ipconfig` (Windows) → mục *IPv4 Address* của card Wi-Fi.

### 2.3. Build dev client (APK) — làm 1 lần

App dùng native module nên **không chạy trên Expo Go**. Cần build dev client:

```bash
cd expo-app
eas login                       # nếu chưa đăng nhập
eas build --profile development --platform android
```

Profile `development` (trong `eas.json`) build **APK** (`buildType: apk`, `:app:assembleDebug`), `developmentClient: true`. Build xong tải APK về và **cài lên thiết bị Android**.

### 2.4. Chạy

```bash
npx expo start --dev-client
```

Mở app dev client đã cài trên điện thoại, quét QR (hoặc nhập URL). Đảm bảo điện thoại và máy dev **cùng mạng Wi-Fi**.

> Lần đầu `expo start` cũng tự sinh lại `.expo/types/router.d.ts` (typed routes). File này được gitignore — **không sửa tay**, để Expo tự sinh.

---

## 3. Cấu hình trên thiết bị Android

Một số tính năng cần quyền hệ thống — cấp thủ công trên máy Android:

1. **Notification Access** — để app đọc thông báo ngân hàng và **auto-import giao dịch**:
   *Settings → Apps → Special access → Notification access → bật **BudgetBee***.
2. **Tắt tối ưu pin (battery optimization)** cho BudgetBee — để service đọc thông báo không bị OS kill:
   *Settings → Apps → BudgetBee → Battery → **Unrestricted / Don't optimize***.

> **Auto-import giao dịch từ thông báo chỉ hoạt động trên Android.** iOS không cho app đọc thông báo hệ thống nên tính năng này không khả dụng.

---

## 4. Tài khoản & luồng đăng nhập

- Đăng ký bằng email + mật khẩu, xác thực qua **OTP gửi email** (Brevo).
- Quên mật khẩu: nhận **OTP** hoặc **magic-link** đặt lại mật khẩu qua email.
- Đăng nhập sinh trắc học (vân tay / khuôn mặt thiết bị) sau khi đã thiết lập.

> Ở môi trường `local`, có thể bật `OTP_DEV_RETURN_CODE=true` trong `.env` để API trả OTP ngay trong response (tiện test, khỏi mở email). **Production phải để `false`** — endpoint quên/đặt lại mật khẩu không bao giờ trả mã OTP ra response.

---

## 5. Lỗi thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
| --- | --- |
| `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` khi `expo start` | Đang chạy Node 22/24. **Dùng Node 20 LTS.** |
| App không gọi được API (timeout) | Backend chưa chạy `--host=0.0.0.0`, hoặc `EXPO_PUBLIC_API_URL` trỏ sai IP LAN, hoặc điện thoại khác mạng Wi-Fi. |
| Không nhận được email OTP | Kiểm tra `storage/logs/laravel.log` dòng `OTP mail send failed`. Lỗi `525 5.7.1 Unauthorized IP` → thêm IP vào Brevo Authorized IPs. Nhớ kiểm tra cả hộp **Spam**. |
| Sửa `.env` không có tác dụng | Chạy `php artisan config:clear`. |
| App báo phải dùng dev client | Không dùng Expo Go — cài APK build từ `eas build --profile development`. |
