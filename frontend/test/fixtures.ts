/** Shared test fixtures for the permission-aware UI. */

/** Every permission an ADMIN gets (mirrors backend seed) — keeps nav/guards open in tests. */
export const ALL_PERMISSIONS = [
  'catalog:read', 'catalog:write',
  'product:read', 'product:write',
  'inventory:read', 'inventory:write',
  'sale:read', 'sale:create', 'sale:cancel', 'sale:return', 'sale:override_price',
  'customer:read', 'customer:write',
  'purchase:read', 'purchase:create',
  'vendor:read', 'vendor:write',
  'dashboard:read',
  'report:read', 'report:export',
  'alert:read', 'alert:acknowledge',
  'settings:read', 'settings:write',
  'audit:read', 'team:manage',
];

export interface StoredUserOverrides {
  permissions?: string[];
  role?: string;
  hasPassword?: boolean;
  onboardingCompletedAt?: string | null;
}

/** Builds the ts_user localStorage payload for an authenticated test session. */
export function makeStoredUser(overrides: StoredUserOverrides = {}) {
  return {
    id: 'u1',
    tenantId: 't1',
    tenantName: 'Shop',
    onboardingCompletedAt:
      overrides.onboardingCompletedAt !== undefined
        ? overrides.onboardingCompletedAt
        : '2026-01-01T00:00:00Z',
    fullName: 'Test Admin',
    email: 'a@b.c',
    role: overrides.role ?? 'ADMIN',
    permissions: overrides.permissions ?? ALL_PERMISSIONS,
    hasPassword: overrides.hasPassword ?? true,
  };
}

/** Seeds localStorage with an authenticated admin session. */
export function seedAuthedSession(overrides: StoredUserOverrides = {}): void {
  localStorage.setItem('ts_access', 'test-token');
  localStorage.setItem('ts_user', JSON.stringify(makeStoredUser(overrides)));
}
