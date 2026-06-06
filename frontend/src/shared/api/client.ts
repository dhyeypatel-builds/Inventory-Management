import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/shared/api/env';

// ─── Token store (localStorage) ────────────────────────────────────────────────

const ACCESS_KEY = 'ts_access';
const REFRESH_KEY = 'ts_refresh';

export const tokenStore = {
  getAccess: (): string | null => localStorage.getItem(ACCESS_KEY),
  getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string): void => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: (): void => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// ─── Forced-logout hook ─────────────────────────────────────────────────────────
// The AuthProvider registers a handler so a failed token refresh can flip the
// app to a logged-out state (which then redirects to /login via the guard).

type AuthFailureHandler = () => void;
let onAuthFailure: AuthFailureHandler | null = null;
export const setAuthFailureHandler = (fn: AuthFailureHandler | null): void => {
  onAuthFailure = fn;
};

// ─── Axios instance ─────────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

const isAuthEndpoint = (url?: string): boolean =>
  !!url && (url.includes('/auth/login') || url.includes('/auth/refresh'));

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Single-flight refresh: concurrent 401s share one refresh round-trip.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new Error('No refresh token available');

  // Bare axios call (not `api`) to bypass the interceptors and avoid recursion.
  const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
  const { accessToken, refreshToken: newRefresh } = res.data.data as {
    accessToken: string;
    refreshToken: string;
  };
  tokenStore.set(accessToken, newRefresh);
  return accessToken;
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// On 401: refresh once, then replay the original request. If refresh fails,
// clear the session and notify the app.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retry && !isAuthEndpoint(original.url)) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise ?? refreshAccessToken();
        const newToken = await refreshPromise;
        refreshPromise = null;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError) {
        refreshPromise = null;
        tokenStore.clear();
        onAuthFailure?.();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
