import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request tenant context, carried through the async call stack via
 * AsyncLocalStorage. Populated by the `authenticate` middleware (Phase 2A V-02)
 * and, later, by the platform-auth middleware (Phase 2B).
 *
 * Stage 2 status: the context is wired and populated, but nothing reads it to
 * filter queries yet. Stage 3 turns on the Prisma scoping extension which calls
 * `currentTenant()` here.
 */
export interface TenantContext {
  /** The tenant the request operates within. `null` for platform admins. */
  tenantId: string | null;
  /** True for platform-admin requests (Phase 2B); bypasses tenant scoping. */
  platform: boolean;
  /** When a platform admin impersonates a tenant, the pinned tenant id. */
  impersonatingTenantId?: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

/** Run `fn` (and everything it awaits) within the given tenant context. */
export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** The raw context, or `undefined` when called outside any request scope. */
export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/**
 * The effective tenant id for scoping a query. Fail-closed: throws when there is
 * no usable tenant rather than silently returning unscoped data. Used by the
 * Stage 3 scoping extension; safe to call now, though no production path does yet.
 *
 * Platform contexts must pin a tenant (impersonation) to resolve here; otherwise
 * the scoping extension is expected to bypass scoping entirely for them.
 */
export function currentTenant(): string {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      'No tenant context: a tenant-scoped operation ran outside a request scope',
    );
  }
  if (ctx.platform) {
    if (!ctx.impersonatingTenantId) {
      throw new Error(
        'Platform context has no tenant pinned; impersonate a tenant for tenant-scoped reads',
      );
    }
    return ctx.impersonatingTenantId;
  }
  if (!ctx.tenantId) {
    throw new Error('Tenant context is missing a tenantId');
  }
  return ctx.tenantId;
}
