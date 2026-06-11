import { Prisma } from '@prisma/client';
import { getTenantContext } from './context';

/**
 * Phase 2A U-02 — tenant scoping extension.
 *
 * Auto-injects `tenant_id` into every query against a tenant-scoped model:
 *   - reads/updates/deletes  → adds `where.tenantId`
 *   - create / createMany    → sets `data.tenantId`
 *   - upsert                 → sets `create.tenantId` (caller supplies the
 *                              compound unique `where` including tenantId)
 *
 * Scoping is applied only when a tenant is in scope (a tenant-user request, or a
 * platform admin impersonating a tenant). With no request context — the seed,
 * background jobs, the pre-auth login lookup, or a non-impersonating platform
 * admin — queries pass through unscoped. The single-default-tenant world (Phase
 * 1 data + the existing test suite) therefore behaves identically.
 *
 * IMPORTANT: this does NOT touch `$queryRaw` / `$executeRaw`. Raw SQL is scoped
 * by hand in reports / dashboard / inventory (U-03).
 */

// Prisma model names (PascalCase) that carry `tenant_id`.
const SCOPED_MODELS = new Set<string>([
  'User',
  'Brand',
  'Category',
  'Product',
  'ProductVariant',
  'VariantAttributeValue',
  'Inventory',
  'StockMovement',
  'Customer',
  'Sale',
  'SaleItem',
  'Alert',
  'AuditLog',
  'Setting',
  'Invite',
  'Vendor',
  'Purchase',
  'PurchaseItem',
  'SerialNumber',
]);

/** The tenant to scope to, or null to pass through unscoped. */
function scopeTenant(): string | null {
  const ctx = getTenantContext();
  if (!ctx) return null; // system / seed / pre-auth / job
  if (ctx.platform) return ctx.impersonatingTenantId ?? null; // platform bypass unless impersonating
  return ctx.tenantId;
}

export const tenancyExtension = Prisma.defineExtension({
  name: 'tenancy',
  query: {
    $allModels: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async $allOperations({ model, operation, args, query }: any) {
        if (!model || !SCOPED_MODELS.has(model)) return query(args);

        const tenantId = scopeTenant();
        if (!tenantId) return query(args);

        const a = (args ?? {}) as Record<string, unknown>;

        switch (operation) {
          case 'findUnique':
          case 'findUniqueOrThrow':
          case 'findFirst':
          case 'findFirstOrThrow':
          case 'findMany':
          case 'count':
          case 'aggregate':
          case 'groupBy':
          case 'update':
          case 'updateMany':
          case 'delete':
          case 'deleteMany':
            a.where = { ...((a.where as object) ?? {}), tenantId };
            break;
          case 'create':
            a.data = { ...((a.data as object) ?? {}), tenantId };
            break;
          case 'createMany':
            if (Array.isArray(a.data)) {
              a.data = (a.data as Record<string, unknown>[]).map((d) => ({ ...d, tenantId }));
            } else {
              a.data = { ...((a.data as object) ?? {}), tenantId };
            }
            break;
          case 'upsert':
            a.create = { ...((a.create as object) ?? {}), tenantId };
            break;
          default:
            break;
        }

        return query(a);
      },
    },
  },
});
