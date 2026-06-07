import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/shared/api/env';

// ─── Access-token store ─────────────────────────────────────────────────────────
// Only the short-lived access token lives in JS storage. The refresh token is an
// httpOnly cookie set by the server (never readable here) — see backend OA-04.

const ACCESS_KEY = 'ts_access';

export const tokenStore = {
  getAccess: (): string | null => localStorage.getItem(ACCESS_KEY),
  set: (access: string): void => localStorage.setItem(ACCESS_KEY, access),
  clear: (): void => localStorage.removeItem(ACCESS_KEY),
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
// withCredentials so the httpOnly refresh cookie rides along on /auth/* calls.

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

const isAuthEndpoint = (url?: string): boolean =>
  !!url && (url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/otp'));

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Single-flight refresh: concurrent 401s share one refresh round-trip.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // No body: the refresh token is sent automatically as the httpOnly cookie.
  // Bare axios (not `api`) to bypass the interceptors and avoid recursion.
  const res = await axios.post(
    `${API_BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true },
  );
  const { accessToken } = res.data.data as { accessToken: string };
  tokenStore.set(accessToken);
  return accessToken;
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// On 401: refresh once (via cookie), then replay the original request. If refresh
// fails, clear the session and notify the app.
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
