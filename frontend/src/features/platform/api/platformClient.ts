import axios, { type AxiosError } from 'axios';
import { API_BASE_URL } from '@/shared/api/env';

// ─── Platform token store ──────────────────────────────────────────────────────
// The master-admin console is a separate trust domain from the tenant app, so it
// keeps its own token under a distinct key. Platform tokens are access-only
// (no rotating refresh): when one expires the admin is sent back to login.

const PLATFORM_TOKEN_KEY = 'ts_platform_token';

export const platformTokenStore = {
  get: (): string | null => localStorage.getItem(PLATFORM_TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(PLATFORM_TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(PLATFORM_TOKEN_KEY),
};

// ─── Forced-logout hook ─────────────────────────────────────────────────────────

type AuthFailureHandler = () => void;
let onAuthFailure: AuthFailureHandler | null = null;
export const setPlatformAuthFailureHandler = (fn: AuthFailureHandler | null): void => {
  onAuthFailure = fn;
};

// ─── Axios instance (scoped to /platform) ──────────────────────────────────────

export const platformApi = axios.create({
  baseURL: `${API_BASE_URL}/platform`,
  headers: { 'Content-Type': 'application/json' },
});

platformApi.interceptors.request.use((config) => {
  const token = platformTokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const isLoginEndpoint = (url?: string): boolean => !!url && url.includes('/auth/login');

// No refresh round-trip — a 401 on anything but login ends the session.
platformApi.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    if ((status === 401 || status === 403) && !isLoginEndpoint(error.config?.url)) {
      platformTokenStore.clear();
      onAuthFailure?.();
    }
    return Promise.reject(error);
  },
);
