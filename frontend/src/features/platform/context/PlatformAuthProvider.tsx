import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  platformTokenStore,
  setPlatformAuthFailureHandler,
} from '../api/platformClient';
import type { PlatformAdmin } from '../types';

const ADMIN_KEY = 'ts_platform_admin';

interface PlatformAuthContextValue {
  admin: PlatformAdmin | null;
  isAuthenticated: boolean;
  login: (token: string, admin: PlatformAdmin) => void;
  logout: () => void;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null);

function readStoredAdmin(): PlatformAdmin | null {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    return raw ? (JSON.parse(raw) as PlatformAdmin) : null;
  } catch {
    return null;
  }
}

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(() =>
    platformTokenStore.get() ? readStoredAdmin() : null,
  );

  const login = useCallback((token: string, nextAdmin: PlatformAdmin) => {
    platformTokenStore.set(token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(nextAdmin));
    setAdmin(nextAdmin);
  }, []);

  const logout = useCallback(() => {
    platformTokenStore.clear();
    localStorage.removeItem(ADMIN_KEY);
    setAdmin(null);
  }, []);

  // An expired/invalid platform token (caught in the interceptor) ends the session.
  useEffect(() => {
    setPlatformAuthFailureHandler(() => {
      localStorage.removeItem(ADMIN_KEY);
      setAdmin(null);
    });
    return () => setPlatformAuthFailureHandler(null);
  }, []);

  const value = useMemo<PlatformAuthContextValue>(
    () => ({ admin, isAuthenticated: !!admin, login, logout }),
    [admin, login, logout],
  );

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
}

export function usePlatformAuth(): PlatformAuthContextValue {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error('usePlatformAuth must be used within a PlatformAuthProvider');
  return ctx;
}
