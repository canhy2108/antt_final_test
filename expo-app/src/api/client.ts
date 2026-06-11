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
 * Resolution order:
 *   1. `EXPO_PUBLIC_API_URL` env (set in .env or shell) — explicit override.
 *   2. `extra.apiUrl` in app.json — for staged builds.
 *   3. Auto-detected from Metro dev server — works on any Wi-Fi without
 *      the developer typing an IP.
 *   4. `http://localhost:8000/api` — last-ditch fallback for web/sim.
 */
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  deriveApiUrlFromMetro() ??
  `http://localhost:${API_PORT}/api`;

if (__DEV__) {
  // Surface the chosen URL once at boot so debugging cross-network
  // issues from device logs is straightforward.
  // eslint-disable-next-line no-console
  console.log('[api] baseURL =', API_URL);
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
 * error explicitly). For these we must NOT auto-redirect to login, because
 * doing so would interrupt the in-progress UX (e.g. typing wrong password).
 */
const SKIP_401_REDIRECT = ['/login', '/verify-otp', '/register', '/resend-otp'];

let redirectingToLogin = false;

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err?.response?.status === 401) {
      const url: string | undefined = err?.config?.url;
      const skip = url && SKIP_401_REDIRECT.some((p) => url.endsWith(p));
      if (!skip) {
        // Session expired (or invalid token). Clear it and bounce to login.
        // `redirectingToLogin` guards against multiple in-flight 401s
        // firing the same navigation many times.
        await secureStorage.clearSession();
        if (!redirectingToLogin) {
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
      }
    }
    return Promise.reject(err);
  },
);
