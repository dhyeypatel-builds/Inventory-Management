import { Prisma } from '@prisma/client';
import { SCOPED_MODELS } from '../tenancy/scoped-prisma';

/**
 * Tenancy-isolation gate: every Prisma model that carries a `tenantId` column
 * MUST be registered in SCOPED_MODELS, or its queries silently run unscoped —
 * a cross-tenant data leak. This test derives the expected set from the Prisma
 * schema (DMMF), so adding a tenant-owned table without registering it fails CI.
 */
describe('SCOPED_MODELS completeness', () => {
  // Documented exceptions — models that carry tenantId but are deliberately
  // NOT auto-scoped. Add here ONLY with a reason:
  // - PlatformAuditLog: platform-level append-only log; tenantId is a loose
  //   cross-tenant reference written/read exclusively from the platform-admin
  //   context, which bypasses scoping anyway.
  const EXCEPTIONS = new Set(['PlatformAuditLog']);

  const modelsWithTenantId = Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'tenantId' && f.kind === 'scalar'))
    .map((m) => m.name)
    .filter((name) => !EXCEPTIONS.has(name))
    .sort();

  it('matches exactly the schema models that carry tenantId', () => {
    expect([...SCOPED_MODELS].sort()).toEqual(modelsWithTenantId);
  });

  it('covers at least the core business tables (sanity)', () => {
    for (const model of ['User', 'Sale', 'Customer', 'Inventory', 'Invite']) {
      expect(SCOPED_MODELS.has(model)).toBe(true);
    }
  });
});
