import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { sha256Hex } from '../../utils/hash';
import { sendInviteEmail } from '../../email';
import { signImpersonationToken } from './platform-auth.service';

const STARTER_BRANDS = ['Michelin', 'Dunlop', 'Pirelli', 'Continental', 'Goodyear', 'Bridgestone'];

function defaultSettings(shopName: string): { key: string; value: Prisma.InputJsonValue }[] {
  return [
    { key: 'company.name', value: shopName },
    { key: 'company.phone', value: '' },
    { key: 'company.address', value: '' },
    { key: 'company.vat_number', value: '' },
    { key: 'tax.default_pct', value: 20 },
    { key: 'inventory.default_reorder_level', value: 5 },
  ];
}

// ─── Audit ───────────────────────────────────────────────────────────────────

interface AuditCtx {
  actorId?: string;
  ip?: string;
}

async function audit(
  action: string,
  tenantId: string | null,
  ctx: AuditCtx,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.platformAuditLog.create({
    data: { action, tenantId, actorId: ctx.actorId ?? null, ipAddress: ctx.ip ?? null, metadata },
  });
}

// ─── List + detail (usage metrics; intentionally cross-tenant raw SQL) ─────────

export interface TenantUsage {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  createdAt: Date;
  onboardingCompletedAt: Date | null;
  skuCount: number;
  customerCount: number;
  sales30d: number;
  lastSaleAt: Date | null;
}

interface UsageRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  created_at: Date;
  onboarding_completed_at: Date | null;
  sku_count: bigint;
  customer_count: bigint;
  sales_30d: bigint;
  last_sale_at: Date | null;
}

const toUsage = (r: UsageRow): TenantUsage => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  status: r.status,
  plan: r.plan,
  createdAt: r.created_at,
  onboardingCompletedAt: r.onboarding_completed_at,
  skuCount: Number(r.sku_count),
  customerCount: Number(r.customer_count),
  sales30d: Number(r.sales_30d),
  lastSaleAt: r.last_sale_at,
});

const USAGE_SELECT = Prisma.sql`
  SELECT t.id, t.name, t.slug, t.status::text AS status, t.plan,
         t.created_at, t.onboarding_completed_at,
         (SELECT COUNT(*) FROM product_variants pv
            WHERE pv.tenant_id = t.id AND pv.deleted_at IS NULL AND pv.is_active) AS sku_count,
         (SELECT COUNT(*) FROM customers c
            WHERE c.tenant_id = t.id AND c.deleted_at IS NULL) AS customer_count,
         (SELECT COUNT(*) FROM sales s
            WHERE s.tenant_id = t.id AND s.sold_at >= NOW() - INTERVAL '30 days') AS sales_30d,
         (SELECT MAX(s.sold_at) FROM sales s WHERE s.tenant_id = t.id) AS last_sale_at
  FROM tenants t
`;

export async function listTenants(opts: { status?: string; q?: string } = {}): Promise<TenantUsage[]> {
  const conditions: Prisma.Sql[] = [];
  if (opts.status) conditions.push(Prisma.sql`t.status = ${opts.status}::"TenantStatus"`);
  if (opts.q) conditions.push(Prisma.sql`(t.name ILIKE ${'%' + opts.q + '%'} OR t.slug ILIKE ${'%' + opts.q + '%'})`);
  const where = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<UsageRow[]>`
    ${USAGE_SELECT} ${where} ORDER BY t.created_at DESC
  `;
  return rows.map(toUsage);
}

export async function getTenant(id: string): Promise<TenantUsage> {
  const rows = await prisma.$queryRaw<UsageRow[]>`
    ${USAGE_SELECT} WHERE t.id = ${id}
  `;
  if (rows.length === 0) throw new NotFoundError('Tenant');
  return toUsage(rows[0]);
}

// ─── Provision ─────────────────────────────────────────────────────────────────

export interface ProvisionInput {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerName: string;
}

export interface ProvisionResult {
  tenant: { id: string; name: string; slug: string };
  owner: { id: string; email: string };
  invite: { token: string; path: string; expiresAt: Date };
}

export async function provisionTenant(input: ProvisionInput, ctx: AuditCtx): Promise<ProvisionResult> {
  const adminRole = await prisma.role.findFirstOrThrow({ where: { name: 'ADMIN' } });
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: input.name, slug: input.slug, status: 'ACTIVE' },
      });

      const owner = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.ownerEmail,
          fullName: input.ownerName,
          passwordHash: null, // passwordless until the invite is accepted (2C)
          roleId: adminRole.id,
        },
      });

      await tx.setting.createMany({
        data: defaultSettings(input.name).map((s) => ({ tenantId: tenant.id, key: s.key, value: s.value })),
      });

      await tx.brand.createMany({
        data: STARTER_BRANDS.map((name) => ({ tenantId: tenant.id, name })),
      });

      await tx.invite.create({
        data: {
          tenantId: tenant.id,
          email: input.ownerEmail,
          roleId: adminRole.id,
          tokenHash: sha256Hex(token),
          expiresAt,
          invitedBy: ctx.actorId ?? null,
        },
      });

      return { tenant, owner };
    });

    await audit('PROVISION_TENANT', result.tenant.id, ctx, { slug: input.slug });

    // Email the owner their invite (fail-soft — the copy-able link is the
    // fallback, so a mail hiccup never undoes provisioning).
    await sendInviteEmail({
      to: input.ownerEmail,
      shopName: input.name,
      inviteUrl: `${env.APP_URL}/invite/${token}`,
      kind: 'owner',
      expiresAt,
    });

    return {
      tenant: { id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug },
      owner: { id: result.owner.id, email: result.owner.email },
      invite: { token, path: `/invite/${token}`, expiresAt },
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'value';
      throw new ConflictError(`A tenant or user with that ${target} already exists`);
    }
    throw err;
  }
}

// ─── Suspend / reactivate ────────────────────────────────────────────────────

export async function suspendTenant(id: string, ctx: AuditCtx): Promise<TenantUsage> {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new NotFoundError('Tenant');

  await prisma.tenant.update({ where: { id }, data: { status: 'SUSPENDED' } });
  // Kill live sessions: revoke every active refresh token for this tenant's users.
  await prisma.refreshToken.updateMany({
    where: { revokedAt: null, user: { tenantId: id } },
    data: { revokedAt: new Date() },
  });

  await audit('SUSPEND_TENANT', id, ctx);
  return getTenant(id);
}

export async function reactivateTenant(id: string, ctx: AuditCtx): Promise<TenantUsage> {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new NotFoundError('Tenant');

  await prisma.tenant.update({ where: { id }, data: { status: 'ACTIVE' } });
  await audit('REACTIVATE_TENANT', id, ctx);
  return getTenant(id);
}

// ─── Impersonate ──────────────────────────────────────────────────────────────

export interface ImpersonateResult {
  accessToken: string;
  tenant: { id: string; name: string };
}

export async function impersonateTenant(id: string, ctx: AuditCtx): Promise<ImpersonateResult> {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new NotFoundError('Tenant');

  const accessToken = await signImpersonationToken(ctx.actorId ?? 'unknown', id);
  await audit('IMPERSONATE_START', id, ctx);
  return { accessToken, tenant: { id: tenant.id, name: tenant.name } };
}
