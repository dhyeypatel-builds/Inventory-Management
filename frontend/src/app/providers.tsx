import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/shared/api/queryClient';
import { tokenStore, setAuthFailureHandler } from '@/shared/api/client';
import { logout as logoutApi } from '@/features/auth/api/auth.api';
import { PlatformAuthProvider } from '@/features/platform/context/PlatformAuthProvider';

// ─── Auth context ───────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  tenantId: string;
  tenantName: string;
  /** null until the shop finishes onboarding (Phase 2C). */
  onboardingCompletedAt: string | null;
  fullName: string;
  email: string;
  role: string;
  permissions: string[];
  /** False for passwordless (invited) users until they set one. Optional for
   * sessions stored before this field existed. */
  hasPassword?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** Persist the access token + user and mark the session authenticated. */
  login: (accessToken: string, user: AuthUser) => void;
  /** Update the cached user (e.g. after completing onboarding). */
  setUser: (user: AuthUser) => void;
  /** Clear the session (also clears the server refresh cookie). */
  logout: () => void;
}

const USER_KEY = 'ts_user';
const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() =>
    tokenStore.getAccess() ? readStoredUser() : null,
  );

  const login = useCallback((accessToken: string, nextUser: AuthUser) => {
    tokenStore.set(accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUserState(nextUser);
  }, []);

  const setUser = useCallback((nextUser: AuthUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUserState(nextUser);
  }, []);

  const logout = useCallback(() => {
    void logoutApi();
    tokenStore.clear();
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('ts_impersonation');
    setUserState(null);
  }, []);

  // A failed token refresh (in the axios interceptor) forces a logout.
  useEffect(() => {
    setAuthFailureHandler(() => {
      tokenStore.clear();
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem('ts_impersonation');
      setUserState(null);
    });
    return () => setAuthFailureHandler(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: !!user, login, setUser, logout }),
    [user, login, setUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

// ─── Root providers ───────────────────────────────────────────────────────────

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PlatformAuthProvider>
        <AuthProvider>{children}</AuthProvider>
      </PlatformAuthProvider>
    </QueryClientProvider>
  );
}
