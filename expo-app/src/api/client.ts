import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { secureStorage } from '@/services/secureStorage';

// LAN IP của máy dev — mobile device phải reach được URL này. Khi
// thay đổi network, sửa ở đây hoặc set EXPO_PUBLIC_API_URL trong env.
const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://192.168.1.10:8000/api';

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
