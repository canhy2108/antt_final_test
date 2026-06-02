# 🐝 BudgetBee — Hướng dẫn chạy dự án trên Android Studio

**Dành cho:** Team Dev
**Cập nhật:** 2026-05-26
**Ước tính thời gian setup lần đầu:** 60–90 phút (download deps + build)

---

## 📋 Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Yêu cầu hệ thống](#2-yêu-cầu-hệ-thống)
3. [Cài phần mềm bắt buộc](#3-cài-phần-mềm-bắt-buộc)
4. [Clone & cấu trúc repo](#4-clone--cấu-trúc-repo)
5. [Bước A — Khởi động Backend (Docker)](#5-bước-a--khởi-động-backend-docker)
6. [Bước B — Setup Mobile (Flutter + Android Studio)](#6-bước-b--setup-mobile-flutter--android-studio)
7. [Bước C — Tạo tài khoản test](#7-bước-c--tạo-tài-khoản-test)
8. [Bước D — Chạy app trên Emulator](#8-bước-d--chạy-app-trên-emulator)
9. [Workflow hằng ngày](#9-workflow-hằng-ngày)
10. [Troubleshooting](#10-troubleshooting)
11. [Cheat sheet](#11-cheat-sheet)

---

## 1. Tổng quan kiến trúc

```
┌──────────────────────────────────────────────┐
│  Mobile App (Flutter)                        │
│  mobile/                                     │
│  Dart + Riverpod + GoRouter + Dio            │
└─────────────────┬────────────────────────────┘
                  │ HTTP REST + cookies
                  ▼
┌──────────────────────────────────────────────┐
│  Nginx Reverse Proxy   (Docker)              │
│  port 80                                     │
└─────────────────┬────────────────────────────┘
                  │ FastCGI
                  ▼
┌──────────────────────────────────────────────┐
│  Laravel API (PHP 8.2 + Sanctum)             │
│  api/                                        │
└─────────────────┬────────────────────────────┘
                  │ PDO
                  ▼
┌──────────────────────────────────────────────┐
│  MySQL 8.2     (Docker volume)               │
└──────────────────────────────────────────────┘

Bonus services (chưa bắt buộc để chạy mobile):
- web/   : React SPA (frontend trình duyệt)
- android/ : Native Android app (Java)
```

**Mobile chỉ cần Backend + DB chạy → KHÔNG cần web React.**

---

## 2. Yêu cầu hệ thống

| Thông số | Tối thiểu | Khuyến nghị |
|---|---|---|
| OS | Windows 10/11 64-bit, macOS 12+, Ubuntu 22+ | Windows 11 hoặc macOS |
| RAM | 16 GB | 32 GB |
| Ổ cứng trống | 30 GB | 50 GB SSD |
| CPU | 4 core | 8 core (hỗ trợ ảo hóa) |
| Mạng | Băng thông ổn định (download ~5GB lần đầu) | |

⚠️ **Bật ảo hóa CPU trong BIOS** (Intel VT-x / AMD-V) — bắt buộc để chạy Android emulator.

---

## 3. Cài phần mềm bắt buộc

### 3.1. Docker Desktop (cho Backend)
- Download: https://www.docker.com/products/docker-desktop/
- Phiên bản khuyến nghị: **4.34.0+** (tránh các bản có Inference Manager bug)
- Sau khi cài → bật `Settings → General → Use WSL 2 based engine` (Windows)
- Verify: `docker --version` và `docker info` (phải in `Server Version`)

### 3.2. Android Studio
- Download: https://developer.android.com/studio
- Phiên bản: **Hedgehog 2023.1.1** hoặc mới hơn
- Trong setup wizard chọn: **Android SDK Platform 34+, Android SDK Build-Tools, Android Emulator**

### 3.3. Flutter SDK
- Download: https://docs.flutter.dev/get-started/install/windows
- Phiên bản: **3.41.x stable** (Dart 3.11.x)
- Giải nén vào `C:\flutter` (Windows) hoặc `~/flutter` (macOS/Linux)
- Thêm vào `PATH`:
  - Windows: `setx PATH "%PATH%;C:\flutter\bin"` (mở terminal mới)
  - macOS/Linux: thêm `export PATH="$PATH:$HOME/flutter/bin"` vào `~/.zshrc` hoặc `~/.bashrc`
- Verify: `flutter --version`

### 3.4. Cài Flutter & Dart plugin trong Android Studio
1. Mở Android Studio → `File → Settings → Plugins → Marketplace`
2. Tìm **Flutter** → Install (Dart plugin sẽ tự cài kèm)
3. Restart Android Studio

### 3.5. Chấp nhận Android SDK licenses
```powershell
flutter doctor --android-licenses
# Bấm "y" cho tất cả prompt
```

### 3.6. Verify toàn bộ
```powershell
flutter doctor -v
```
Cần thấy ✅ ở: **Flutter, Android toolchain, Android Studio**. Nếu có ❌ thì làm theo gợi ý của flutter doctor.

---

## 4. Clone & cấu trúc repo

```powershell
git clone <repo-url> BudgetBee
cd BudgetBee
```

Cấu trúc thư mục:

```
BudgetBee/
├── HUONG_DAN_CHAY_DU_AN.md  ← file này
├── README.md
├── SECURITY.md
├── api/                      # Laravel backend (PHP)
│   ├── app/
│   ├── database/
│   ├── routes/
│   ├── Dockerfile.dev
│   └── .env (TỰ TẠO — xem bước A.1)
├── mobile/                   # Flutter app
│   ├── lib/
│   ├── android/
│   ├── ios/
│   └── pubspec.yaml
├── web/                      # React SPA (optional)
├── android/                  # Native Android (optional)
├── docker/
│   ├── docker-compose.api-only.yml  # dev backend
│   ├── docker-compose.dev.yml       # backend + web
│   ├── docker-compose.yml           # production
│   ├── nginx/
│   ├── php/opcache.ini
│   └── .env (TỰ TẠO — xem bước A.1)
└── scripts/
```

---

## 5. Bước A — Khởi động Backend (Docker)

### A.1. Tạo file `.env` cho Docker

Tạo file `docker/.env` với nội dung:

```env
APP_PORT=80
APP_PORT_SSL=443

DB_DATABASE=budgetbee
DB_USERNAME=budgetbee
DB_PASSWORD=budgetbee_dev_local_pass
DB_ROOT_PASSWORD=root_dev_local_pass
```

Tạo file `api/.env`:

```env
APP_NAME=BudgetBee
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost
APP_VERSION=v0.11.2

LOG_CHANNEL=stack
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=debug

DB_CONNECTION=mysql
DB_HOST=db
DB_PORT=3306
DB_DATABASE=budgetbee
DB_USERNAME=budgetbee
DB_PASSWORD=budgetbee_dev_local_pass

BROADCAST_DRIVER=log
CACHE_DRIVER=file
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync
SESSION_DRIVER=file
SESSION_LIFETIME=120

SANCTUM_STATEFUL_DOMAINS=localhost,localhost:3000,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost
```

⚠️ `APP_KEY` để trống — entrypoint sẽ tự `php artisan key:generate` lần đầu.

### A.2. Khởi động Docker Desktop

- Windows: Start menu → tìm "Docker Desktop" → bấm chạy. Đợi icon system tray chuyển xanh.
- Verify: `docker info | Select-String "Server Version"` phải in ra version.

### A.3. Build và chạy stack

```powershell
cd C:\path\to\BudgetBee
docker compose -f docker/docker-compose.api-only.yml `
               --env-file docker/.env `
               -p budgetbee_dev up -d --build
```

⏱️ **Lần đầu mất 10–15 phút** (pull MySQL, PHP, Nginx + composer install).

### A.4. Verify backend OK

```powershell
docker compose -f docker/docker-compose.api-only.yml -p budgetbee_dev ps
```
3 services phải `Up`:
- `budgetbee_dev-db-1` (healthy)
- `budgetbee_dev-webserver-1`
- `budgetbee_dev-nginx-dev-1`

Test API:
```powershell
curl http://localhost/api/setup/check
# Output: {"setup_completed":false}  (nếu chưa có user)
```

⚠️ **Request đầu tiên có thể mất 30–60 giây** vì OPcache phải warm Laravel. Sau đó các request sau sub-second.

### A.5. (Tùy chọn) Warm cache tất cả routes

Bỏ qua cold-start cho các tab dashboard:

```powershell
$endpoints = @("/api/setup/check","/api/account","/api/category/parent","/api/category","/api/budget","/api/upcoming-expenses","/api/user/settings","/api/user/currencies","/api/account/type","/api/account/currencies","/api/record/last?limit=10","/api/balance/all?from_date=2026-01-01&to_date=2026-12-31")
foreach ($e in $endpoints) { try { Invoke-WebRequest -Uri "http://localhost$e" -TimeoutSec 180 -UseBasicParsing | Out-Null; Write-Host "OK $e" } catch { Write-Host "SKIP $e" } }
```

---

## 6. Bước B — Setup Mobile (Flutter + Android Studio)

### B.1. Mở project Flutter

- Mở Android Studio → **Open** → chọn thư mục `BudgetBee/mobile` (KHÔNG mở `mobile/android` — đó là subproject)
- Android Studio sẽ nhận diện là Flutter project (icon Flutter ở góc trên)

### B.2. Đảm bảo `local.properties`

Mở `mobile/android/local.properties` (nếu chưa có thì tạo):

```properties
sdk.dir=C:\\Users\\<USERNAME>\\AppData\\Local\\Android\\sdk
flutter.sdk=C:\\flutter
flutter.buildMode=debug
flutter.versionName=1.0.0
flutter.versionCode=1
```

Đổi `<USERNAME>` và đường dẫn flutter SDK cho đúng máy bạn.

### B.3. Cài Flutter dependencies

Trong terminal Android Studio (Alt+F12) hoặc PowerShell:

```powershell
cd C:\path\to\BudgetBee\mobile
flutter pub get
```

Nếu thấy "56 packages have newer versions incompatible" — **không cần update**, đã khóa version tương thích.

### B.4. Tạo Android Emulator

1. `Tools → Device Manager → Create Virtual Device`
2. Chọn **Pixel 7** (cân bằng tốt/nhanh)
3. System Image: **API 34 (UpsideDownCake)** → Download (~1GB)
4. Finish

### B.5. (Khuyên dùng) Bật cleartext cho dev

API local chạy HTTP. File [mobile/android/app/src/main/res/xml/network_security_config.xml](mobile/android/app/src/main/res/xml/network_security_config.xml) đã có sẵn whitelist `10.0.2.2`, `localhost`, `127.0.0.1` → không cần làm gì thêm.

---

## 7. Bước C — Tạo tài khoản test

### C.1. Cách 1 — Đăng ký từ app (UI)

Khi mở app lần đầu chưa có user, app sẽ tự chuyển vào trang **Register**. Nhập:
- Họ tên
- Email
- Password ≥ 12 ký tự (tuân theo NIST 800-63B), KHÔNG nằm trong danh sách HaveIBeenPwned

### C.2. Cách 2 — Tạo qua artisan command (nhanh + có sẵn data)

```powershell
docker exec budgetbee_dev-webserver-1 php artisan test:generate-data `
  --email=dev@budgetbee.local `
  --password=DevPassword2026! `
  --accounts=4 `
  --records=80 `
  --budgets=5 `
  --upcoming=3
```

Tự động tạo:
- 1 user (hoặc tìm user có email đó nếu đã tồn tại)
- 4 tài khoản (Checking, Credit Card, Savings, Investments)
- 80 giao dịch (60% expense, 25% income, 15% transfer) trong 6 tháng qua
- 5 budgets
- 3 upcoming expenses

### C.3. Tài khoản mẫu

| Email | Password |
|---|---|
| dev@budgetbee.local | DevPassword2026! |

(Hoặc tự đăng ký theo Cách 1)

---

## 8. Bước D — Chạy app trên Emulator

### D.1. Khởi động emulator

```powershell
flutter emulators
# Liệt kê emulator có sẵn

flutter emulators --launch Pixel_7
# Đợi 30-60s emulator boot xong
```

### D.2. Verify device

```powershell
flutter devices
# Phải thấy: emulator-5554 • android-x64
```

### D.3. Chạy app

```powershell
cd mobile
flutter run -d emulator-5554
```

Hoặc trong Android Studio: chọn emulator ở thanh trên → bấm ▶ Run (Shift+F10).

⏱️ **Lần đầu build 5–10 phút** (Gradle pull dependencies + NDK 28.2 ~1.5GB).

### D.4. Hot reload / restart

Trong terminal `flutter run`:
- `r` — Hot Reload (giữ state, áp dụng UI change)
- `R` — Hot Restart (reset state, áp dụng logic change)
- `q` — Quit

Khi sửa **AndroidManifest, native code, gradle** → phải `q` rồi `flutter run` lại (rebuild APK).

### D.5. Debug

- **Logs:** View → Tool Windows → Logcat (filter "flutter" để chỉ xem log Dart)
- **DevTools:** `flutter pub global activate devtools` → `flutter pub global run devtools`
- **Inspector:** Tab "Flutter Inspector" bên phải Android Studio khi app đang chạy

---

## 9. Workflow hằng ngày

### Buổi sáng: Khởi động môi trường

```powershell
# 1. Mở Docker Desktop (Start menu)

# 2. Start backend
cd C:\path\to\BudgetBee
docker compose -f docker/docker-compose.api-only.yml --env-file docker/.env -p budgetbee_dev up -d

# 3. Mở Android Studio, open BudgetBee/mobile

# 4. Khởi động emulator + run
flutter emulators --launch Pixel_7
cd mobile
flutter run -d emulator-5554
```

### Buổi tối: Tắt môi trường

```powershell
# Tắt backend (giữ DB volume)
docker compose -f docker/docker-compose.api-only.yml -p budgetbee_dev stop

# Hoặc tắt và xóa hết (mất DB)
docker compose -f docker/docker-compose.api-only.yml -p budgetbee_dev down -v
```

### Khi sửa code Laravel API

Live-reload qua bind-mount → sửa file → next request thấy ngay (cần clear cache nếu sửa config/routes):

```powershell
docker exec budgetbee_dev-webserver-1 php artisan config:clear
docker exec budgetbee_dev-webserver-1 php artisan route:clear
```

### Khi thêm migration mới

```powershell
docker exec budgetbee_dev-webserver-1 php artisan migrate
```

### Khi sửa code Flutter Dart

- UI change: bấm `r` (hot reload) trong terminal
- Logic change: bấm `R` (hot restart)
- Native (Manifest/Gradle): `q` rồi `flutter run` lại

### Khi pull code mới

```powershell
git pull
cd mobile && flutter pub get
docker compose -f ../docker/docker-compose.api-only.yml -p budgetbee_dev up -d --build
docker exec budgetbee_dev-webserver-1 php artisan migrate
```

---

## 10. Troubleshooting

### ❌ Docker: "docker daemon not running"
- Đảm bảo Docker Desktop đang chạy (icon system tray xanh)
- Restart Docker Desktop nếu cần
- Nếu crash liên tục: gỡ + cài lại Docker Desktop **4.34.0** (tránh bug Inference Manager)

### ❌ Docker: port 3306 bị chiếm
- File `docker-compose.api-only.yml` đã không expose 3306 ra host. Nếu vẫn lỗi:
  ```powershell
  docker ps | Select-String 3306
  # Tìm container đang chiếm rồi: docker stop <name>
  ```

### ❌ Backend trả về timeout (504) cho request đầu
- Bình thường lần đầu sau khi start container (Windows mount chậm)
- Đợi ~30-60s rồi thử lại
- Hoặc warm cache theo bước A.5

### ❌ Flutter: "No Windows desktop project configured"
- Bạn quên chỉ device. Dùng `flutter run -d emulator-5554` thay vì `flutter run`
- Hoặc tắt Windows desktop target: `flutter config --no-enable-windows-desktop`

### ❌ Emulator: Connection refused khi gọi API
- App dùng `http://10.0.2.2/api` — đây là alias host từ emulator
- Verify host: `curl http://localhost/api/setup/check` (trên Windows host)
- Nếu host OK mà emulator vẫn refused → restart emulator (`flutter emulators --launch Pixel_7`)
- Nếu chạy trên thiết bị thật (USB): chỉnh URL trong [mobile/lib/core/network/api_client.dart](mobile/lib/core/network/api_client.dart) thành IP máy host

### ❌ Flutter: App báo "isn't responding" (ANR)
- Đã fix sẵn các nguyên nhân chính (Google Fonts blocking, Dio timeout). Đảm bảo:
  - `main.dart`: `GoogleFonts.config.allowRuntimeFetching = false;`
  - `api_client.dart`: `receiveTimeout: Duration(seconds: 120)`
- Nếu vẫn ANR: backend chưa warm — chạy warmup script ở bước A.5

### ❌ Biometric báo "không hỗ trợ" trên emulator
- Vào emulator: Settings → Security → Screen lock → set PIN (vd: 1234)
- (Tùy chọn) Add Fingerprint → trong khi setup, bấm icon `...` (Extended Controls) bên cạnh emulator → Fingerprint → Touch Sensor
- Quay về app → Settings → toggle Sinh trắc học → xác nhận

### ❌ Composer install timeout trong container
- Đó là mạng Docker. Thử: `docker compose -p budgetbee_dev restart webserver`
- Hoặc edit `docker/docker-compose.api-only.yml` thêm vào webserver `extra_hosts: ["packagist.org:..."]`

### ❌ Migrations fail "Class doctrine/dbal not found"
- Migrations FLOAT→DECIMAL của chúng tôi đã viết bằng raw SQL → KHÔNG cần `doctrine/dbal`
- Nếu vẫn lỗi: pull lại code mới hoặc check migration `2026_05_26_120000_convert_money_columns_to_decimal.php` phải dùng `DB::statement()`

### ❌ App vẫn build với pre-built image cũ (không có fix)
- Đảm bảo dùng đúng compose file: **`docker-compose.api-only.yml`** (build từ source) chứ KHÔNG phải `docker-compose.yml` (pull image ghcr.io)
- Project name phải là `-p budgetbee_dev`

### ❌ Hot reload không apply change
- Một số file (model boot events, native code, AndroidManifest) cần Hot RESTART (`R`) hoặc full restart (`q` + run lại)
- Nếu vẫn không OK: `flutter clean && flutter pub get && flutter run`

---

## 11. Cheat sheet

### Docker

```powershell
# Start
docker compose -f docker/docker-compose.api-only.yml --env-file docker/.env -p budgetbee_dev up -d

# Stop (giữ data)
docker compose -f docker/docker-compose.api-only.yml -p budgetbee_dev stop

# Logs
docker logs -f budgetbee_dev-webserver-1
docker logs -f budgetbee_dev-nginx-dev-1
docker logs -f budgetbee_dev-db-1

# Exec into container
docker exec -it budgetbee_dev-webserver-1 sh
docker exec -it budgetbee_dev-db-1 mysql -u root -proot_dev_local_pass budgetbee

# Reset hết (XÓA DB!)
docker compose -f docker/docker-compose.api-only.yml -p budgetbee_dev down -v
```

### Laravel artisan (qua docker exec)

```powershell
# Migrate
docker exec budgetbee_dev-webserver-1 php artisan migrate

# Rollback
docker exec budgetbee_dev-webserver-1 php artisan migrate:rollback

# Seed
docker exec budgetbee_dev-webserver-1 php artisan db:seed

# Tạo test data
docker exec budgetbee_dev-webserver-1 php artisan test:generate-data --email=dev@test.com

# Cache
docker exec budgetbee_dev-webserver-1 php artisan config:cache
docker exec budgetbee_dev-webserver-1 php artisan route:cache
docker exec budgetbee_dev-webserver-1 php artisan config:clear
docker exec budgetbee_dev-webserver-1 php artisan route:clear

# List routes
docker exec budgetbee_dev-webserver-1 php artisan route:list --path=api

# Tinker (REPL)
docker exec -it budgetbee_dev-webserver-1 php artisan tinker
```

### Flutter

```powershell
flutter doctor -v
flutter pub get
flutter pub upgrade
flutter clean
flutter run -d emulator-5554
flutter run -d emulator-5554 --release    # build release mode
flutter build apk --release               # APK release
flutter build appbundle                   # AAB cho Play Store
flutter emulators
flutter emulators --launch Pixel_7
flutter devices
flutter logs                              # xem log device đang connect
flutter analyze                           # static analysis
flutter test                              # chạy unit test
```

### Truy cập MySQL từ tool ngoài (TablePlus/Workbench)

Mặc định DB không expose port. Để bật:

Edit `docker/docker-compose.api-only.yml`, uncomment:
```yaml
    ports:
      - "3307:3306"
```

Rồi restart: `docker compose ... up -d`. Connect string:
```
Host:     localhost
Port:     3307
Database: budgetbee
User:     budgetbee
Password: budgetbee_dev_local_pass
```

---

## 📞 Liên hệ / Hỗ trợ

- Trưởng nhóm BE: <điền sau>
- Trưởng nhóm Mobile: <điền sau>
- DevOps / Docker: <điền sau>

Bug / Issue: tạo issue trên repository hoặc Slack channel `#budgetbee-dev`.

---

## 📚 Tài liệu liên quan

- [SECURITY.md](SECURITY.md) — Best practices bảo mật
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) — Hướng dẫn từng feature
- [FILE_INVENTORY.md](FILE_INVENTORY.md) — Danh sách file quan trọng
- [api/CHANGELOG.md](api/CHANGELOG.md) — Lịch sử backend
- [mobile/README.md](mobile/README.md) — Chi tiết mobile

---

*Hướng dẫn này dựa trên setup thực tế trên Windows 11. macOS/Linux gần như giống — chỉ khác đường dẫn (`/Users/<user>/` thay vì `C:\Users\<user>\`).*

**Chúc team dev BudgetBee build tốt! 🐝🍯**
