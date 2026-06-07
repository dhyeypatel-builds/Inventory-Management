import { tokenStore } from '@/shared/api/client';
import type { AuthUser } from '@/app/providers';
import type { ImpersonateResult } from '../types';

// Bridges a platform admin into a tenant session. The impersonation token is a
// real tenant-ADMIN access token (no refresh, no `platform` claim). We write it
// into the tenant token store and drop a flag so the tenant app shows a banner.

const IMPERSONATION_KEY = 'ts_impersonation';
const USER_KEY = 'ts_user';

export interface ImpersonationState {
  tenantId: string;
  tenantName: string;
}

/** Decode a JWT payload without verifying — used only to seed the local user. */
function decodeJwt(token: string): { sub?: string; role?: string; permissions?: string[]; tenantId?: string } {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export function readImpersonation(): ImpersonationState | null {
  try {
    const raw = localStorage.getItem(IMPERSONATION_KEY);
    return raw ? (JSON.parse(raw) as ImpersonationState) : null;
  } catch {
    return null;
  }
}

/**
 * Start an impersonation session: writes the tenant token + a synthetic user so
 * the tenant AuthProvider treats the session as authenticated, then hard-reloads
 * into the tenant dashboard. A full reload re-initialises the tenant auth state
 * from the freshly written localStorage.
 */
export function startImpersonation(result: ImpersonateResult): void {
  const claims = decodeJwt(result.accessToken);
  const user: AuthUser = {
    id: claims.sub ?? 'impersonated',
    tenantId: claims.tenantId ?? result.tenant.id,
    tenantName: result.tenant.name,
    // Skip the onboarding gate while impersonating (support session, not setup).
    onboardingCompletedAt: new Date().toISOString(),
    fullName: `${result.tenant.name} (impersonated)`,
    email: '',
    role: claims.role ?? 'ADMIN',
    permissions: claims.permissions ?? [],
  };

  // Impersonation tokens have no refresh cookie; the session lasts until the
  // access token expires, after which the interceptor's refresh fails → logout.
  tokenStore.set(result.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(
    IMPERSONATION_KEY,
    JSON.stringify({ tenantId: result.tenant.id, tenantName: result.tenant.name }),
  );

  window.location.assign('/dashboard');
}

/** End an impersonation session and return to the master-admin console. */
export function exitImpersonation(): void {
  localStorage.removeItem(IMPERSONATION_KEY);
  localStorage.removeItem(USER_KEY);
  tokenStore.clear();
  window.location.assign('/admin/tenants');
}
