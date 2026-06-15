import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { secureStorage } from '@/services/secureStorage';

/** Backend port — Laravel `php artisan serve` defaults to 8000. */
const API_PORT = 8000;

/**
 * Auto-detect the dev PC's LAN IP from the Metro dev server.
 *
 * When the phone scans the QR code in Expo Go, Metro hands back a
 * `hostUri` like `192.168.1.10:8081`. That IP is, by definition, the
 * dev PC reachable from the phone right now — exactly what we need for
 * the API base URL. Reusing it means we don't have to ask the user to
 * find their own IP every time they move to a new Wi-Fi.
 *
 * Returns null when:
 *   - Built for production (no Metro)
 *   - Running on web (use the page origin instead)
 *   - Running via tunnel (hostUri is an .exp.direct domain — useless
 *     for the Laravel backend, fall through to the manual env)
 */
function deriveApiUrlFromMetro(): string | null {
  if (Platform.OS === 'web') return null;

  const hostUri =
    (Constants.expoConfig as { hostUri?: string } | null)?.hostUri ??
    (Constants.expoGoConfig as { hostUri?: string } | null)?.hostUri ??
    Constants.linkingUri?.split('://')[1]?.split('/')[0] ??
    null;

  if (!hostUri) return null;

  // Strip the Metro port and any trailing path.
  const hostOnly = hostUri.split('/')[0].split(':')[0];

  // Tunnel mode → host is something like `abc-xyz.exp.direct`. The
  // backend cannot be reached on port 8000 of that host, so don't try.
  if (!hostOnly || hostOnly.includes('exp.direct') || hostOnly.includes('ngrok')) {
    return null;
  }

  // IPv4 sanity check — anything else (IPv6, raw hostname) falls back.
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostOnly)) return null;

  return `http://${hostOnly}:${API_PORT}/api`;
}

/**
 * Last-ditch fallback when nothing else resolves.
 *
 * Bug trước đây: fallback luôn là `http://localhost:8000` — SAI trên:
 *   - Máy thật / Android emulator: `localhost` trỏ về chính điện thoại,
 *     không phải PC backend → mọi API (đăng nhập, sinh trắc) fail.
 *   - Android emulator phải dùng `10.0.2.2` để gọi `localhost` của máy host.
 * Vì vậy ta chọn host theo nền tảng và CẢNH BÁO khi build production rơi
 * vào nhánh này (lẽ ra phải cấu hình EXPO_PUBLIC_API_URL / extra.apiUrl).
 */
function fallbackApiUrl(): string {
  const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${host}:${API_PORT}/api`;
}

/**
 * Resolution order:
 *   1. `EXPO_PUBLIC_API_URL` env (set in .env or shell) — explicit override.
 *   2. Auto-detected from Metro dev server — works on any Wi-Fi without
 *      the developer typing an IP (dev only).
 *   3. `extra.apiUrl` in app.json — for staged / standalone builds with no Metro.
 *   4. Platform-aware localhost fallback — last resort for web / simulator.
 *
 * Lưu ý: Metro auto-detect đặt TRƯỚC extra.apiUrl để khi dev đổi Wi-Fi vẫn
 * tự dò IP; còn extra.apiUrl chỉ dùng cho build không có Metro.
 */
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  deriveApiUrlFromMetro() ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  fallbackApiUrl();

if (__DEV__) {
  // Surface the chosen URL once at boot so debugging cross-network
  // issues from device logs is straightforward.
  // eslint-disable-next-line no-console
  console.log('[api] baseURL =', API_URL);
} else if (
  !process.env.EXPO_PUBLIC_API_URL &&
  !(Constants.expoConfig?.extra?.apiUrl as string | undefined)
) {
  // eslint-disable-next-line no-console
  console.warn(
    '[api] CHƯA cấu hình API URL cho build production. ' +
      'Đặt EXPO_PUBLIC_API_URL hoặc expo.extra.apiUrl trỏ tới server thật (HTTPS).',
  );
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await secureStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Endpoints that 401-on-purpose during normal flow (the FE catches the
 * error explicitly). For these we must NOT auto-redirect to login.
 */
const SKIP_401_REDIRECT = ['/login', '/verify-otp', '/register', '/resend-otp'];

/**
 * Endpoints KHÔNG được tự refresh khi 401 (auth công khai + chính endpoint
 * refresh — tránh đệ quy vô hạn).
 */
const SKIP_401_REFRESH = [
  ...SKIP_401_REDIRECT,
  '/auth/refresh',
  '/forgot-password',
  '/reset-password',
];

let redirectingToLogin = false;

// Single-flight: nhiều request 401 đồng thời chỉ gọi /auth/refresh MỘT lần.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await secureStorage.getRefreshToken();
  if (!refreshToken) return null;
  try {
    // axios thuần (không qua apiClient) để tránh đệ quy interceptor.
    const res = await axios.post(
      `${API_URL}/auth/refresh`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 },
    );
    const data = res.data as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!data?.access_token) return null;
    await secureStorage.saveTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiry: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    });
    return data.access_token;
  } catch {
    return null;
  }
}

function redirectToLogin() {
  if (redirectingToLogin) return;
  redirectingToLogin = true;
  try {
    router.replace('/(auth)/login');
  } catch {
    // router may not be ready yet (e.g. before mount); ignore.
  }
  setTimeout(() => {
    redirectingToLogin = false;
  }, 1500);
}

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    const original: any = err?.config;
    if (status !== 401 || !original) return Promise.reject(err);

    const url: string | undefined = original.url;
    const skipRefresh = !!url && SKIP_401_REFRESH.some((pth) => url.endsWith(pth));

    // Thử refresh access token đúng MỘT lần cho request bị 401.
    if (!skipRefresh && !original._retried) {
      original._retried = true;
      if (!refreshPromise) refreshPromise = refreshAccessToken();
      let newToken: string | null = null;
      try {
        newToken = await refreshPromise;
      } finally {
        refreshPromise = null;
      }
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
    }

    // Không refresh được → dọn phiên + về login (trừ endpoint skip-redirect).
    const skipRedirect = !!url && SKIP_401_REDIRECT.some((pth) => url.endsWith(pth));
    if (!skipRedirect) {
      await secureStorage.clearSession();
      redirectToLogin();
    }
    return Promise.reject(err);
  },
);
