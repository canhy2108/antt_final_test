# BudgetBee — Expo (React Native + TypeScript)

Phiên bản Expo của BudgetBee chạy được trên **Expo Go** qua quét QR — không cần Android Studio / Xcode.

## Yêu cầu

- Node.js 18+ (đã có 24.x)
- Điện thoại cài app **Expo Go**:
  - Android: https://play.google.com/store/apps/details?id=host.exp.exponent
  - iOS: https://apps.apple.com/app/expo-go/id982107779
- Máy tính và điện thoại **cùng mạng Wi-Fi**

## Chạy dev

```bash
cd expo-app
npm start            # mở metro, hiện QR
# hoặc
npm run android      # tự mở Expo Go trên máy ảo đã kết nối adb
```

Quét QR bằng:
- **Android**: app Expo Go → Scan QR code
- **iOS**: app Camera mặc định → quét QR

URL trực tiếp (nếu cần dán tay vào Expo Go):

```
exp://<LAN_IP>:8081
```

(ví dụ `exp://192.168.1.194:8081`).

## Cấu trúc

```
expo-app/
├── app/                    # expo-router (file-based routing)
│   ├── _layout.tsx         # root stack
│   ├── index.tsx           # splash / redirect
│   ├── (auth)/             # nhóm auth (login, register, otp, pin, forgot)
│   ├── (tabs)/             # bottom tabs (dashboard, accounts, reports, settings + FAB)
│   ├── transaction/        # list + new (modal)
│   ├── biometric-lock.tsx  # màn khoá sinh trắc học
│   └── ekyc.tsx            # eKYC camera
├── src/
│   ├── theme/              # Colors, Typography, Radius, Space, Shadow
│   ├── api/                # axios client + endpoints (auth, transactions, accounts, budgets)
│   ├── services/           # secureStorage, biometric
│   ├── stores/             # zustand stores (auth, prefs)
│   ├── types/              # TS models (User, Account, Transaction, ...)
│   ├── mocks/              # mock data (USE_MOCK=true ở các api/*)
│   ├── utils/              # format, haptics
│   └── components/         # PrimaryButton, TextField
├── app.json
├── babel.config.js
├── tsconfig.json
└── package.json
```

## Kết nối API thật

Hiện các file `src/api/*.ts` đang dùng mock (`const USE_MOCK = true`). Để gọi backend thật:

1. Đặt biến `EXPO_PUBLIC_API_URL` trong `.env` hoặc qua `app.json → extra.apiUrl`.
2. Mở từng file `src/api/*.ts` và đổi `USE_MOCK = false`.
3. Đảm bảo backend Laravel đang chạy và điện thoại có thể truy cập (cùng Wi-Fi hoặc dùng `ngrok`/`expo tunnel`).

## Build production

```bash
# Cài EAS CLI
npm install -g eas-cli

# Login expo
eas login

# Build APK/IPA
eas build -p android --profile preview
eas build -p ios --profile preview
```

## Tài khoản demo

Sử dụng bất kỳ email + password ≥ 4 ký tự, hoặc bấm "Đăng nhập bằng sinh trắc học".

Dữ liệu được khởi tạo sẵn trong `src/mocks/data.ts`.
