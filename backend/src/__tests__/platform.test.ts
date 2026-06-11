/**
 * Phase 2B — master-admin console (platform auth + tenant lifecycle).
 */
import request from 'supertest';
import { app } from '../app';
import { prismaBase } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';

const PLATFORM_EMAIL = 'platform-test@tyrestock.test';
const PLATFORM_PASSWORD = 'PlatformTest@123';

let platformToken: string;
const createdTenantIds: string[] = [];

const pAuth = () => ({ Authorization: `Bearer ${platformToken}` });
const uniqueSlug = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

beforeAll(async () => {
  const passwordHash = await hashPassword(PLATFORM_PASSWORD);
  await prismaBase.platformAdmin.upsert({
    where: { email: PLATFORM_EMAIL },
    // Reset lockout counters: the wrong-credentials test below increments them
    // on every run.
    update: { passwordHash, isActive: true, failedLogins: 0, lockedUntil: null },
    create: { email: PLATFORM_EMAIL, fullName: 'Platform Test', passwordHash },
  });
  const res = await request(app)
    .post('/api/v1/platform/auth/login')
    .send({ email: PLATFORM_EMAIL, password: PLATFORM_PASSWORD });
  expect(res.status).toBe(200);
  platformToken = res.body.data.accessToken;
});

afterAll(async () => {
  await prismaBase.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  await prismaBase.platformAdmin.deleteMany({ where: { email: PLATFORM_EMAIL } });
  await prismaBase.$disconnect();
});

async function provision(overrides: Partial<{ name: string; slug: string; ownerEmail: string; ownerName: string }> = {}) {
  const slug = overrides.slug ?? uniqueSlug('shop');
  const res = await request(app)
    .post('/api/v1/platform/tenants')
    .set(pAuth())
    .send({
      name: overrides.name ?? 'Test Shop',
      slug,
      ownerEmail: overrides.ownerEmail ?? `${slug}@owner.test`,
      ownerName: overrides.ownerName ?? 'Shop Owner',
    });
  if (res.status === 201) createdTenantIds.push(res.body.data.tenant.id);
  return res;
}

// ─── Platform auth ────────────────────────────────────────────────────────────

describe('POST /api/v1/platform/auth/login', () => {
  it('rejects wrong credentials with 401', async () => {
    const res = await request(app)
      .post('/api/v1/platform/auth/login')
      .send({ email: PLATFORM_EMAIL, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns a platform token and /auth/me resolves', async () => {
    const me = await request(app).get('/api/v1/platform/auth/me').set(pAuth());
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(PLATFORM_EMAIL);
  });

  it('rejects a tenant-user token on platform endpoints (403)', async () => {
    // Provision a tenant, give its owner a password, log in as a tenant user.
    const prov = await provision();
    const ownerEmail = prov.body.data.owner.email as string;
    await prismaBase.user.update({
      where: { email: ownerEmail },
      data: { passwordHash: await hashPassword('OwnerPass@123') },
    });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password: 'OwnerPass@123' });
    expect(login.status).toBe(200);

    const res = await request(app)
      .get('/api/v1/platform/tenants')
      .set({ Authorization: `Bearer ${login.body.data.accessToken}` });
    expect(res.status).toBe(403);
  });

  it('rejects platform endpoints without a token (401)', async () => {
    const res = await request(app).get('/api/v1/platform/tenants');
    expect(res.status).toBe(401);
  });

  it('locks the platform account after repeated failures (generic 401s)', async () => {
    const email = `lockout-${Date.now()}@tyrestock.test`;
    const admin = await prismaBase.platformAdmin.create({
      data: { email, fullName: 'Lockout Test', passwordHash: await hashPassword('Lock@12345') },
    });

    const max = Number(process.env.AUTH_MAX_FAILED_LOGINS ?? 5);
    for (let i = 0; i < max; i += 1) {
      const res = await request(app)
        .post('/api/v1/platform/auth/login')
        .send({ email, password: 'WrongPass@1' });
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid credentials');
    }

    const locked = await prismaBase.platformAdmin.findUniqueOrThrow({ where: { id: admin.id } });
    expect(locked.lockedUntil).not.toBeNull();

    // Even the correct password is refused (same generic message) while locked.
    const res = await request(app)
      .post('/api/v1/platform/auth/login')
      .send({ email, password: 'Lock@12345' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid credentials');

    // An expired lock clears on the next successful login.
    await prismaBase.platformAdmin.update({
      where: { id: admin.id },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });
    const ok = await request(app)
      .post('/api/v1/platform/auth/login')
      .send({ email, password: 'Lock@12345' });
    expect(ok.status).toBe(200);

    await prismaBase.platformAdmin.delete({ where: { id: admin.id } });
  });
});

// ─── Provisioning ─────────────────────────────────────────────────────────────

describe('POST /api/v1/platform/tenants (provision)', () => {
  it('creates an isolated tenant with owner, settings, brands, and an invite', async () => {
    const slug = uniqueSlug('acme');
    const res = await provision({ name: 'Acme Tyres', slug, ownerEmail: `${slug}@owner.test` });

    expect(res.status).toBe(201);
    expect(res.body.data.tenant.slug).toBe(slug);
    expect(res.body.data.owner.email).toBe(`${slug}@owner.test`);
    expect(typeof res.body.data.invite.token).toBe('string');
    expect(res.body.data.invite.path).toContain(res.body.data.invite.token);

    const tenantId = res.body.data.tenant.id as string;
    const [brands, settings, invites, owner] = await Promise.all([
      prismaBase.brand.count({ where: { tenantId } }),
      prismaBase.setting.count({ where: { tenantId } }),
      prismaBase.invite.count({ where: { tenantId } }),
      prismaBase.user.findUniqueOrThrow({ where: { email: `${slug}@owner.test` } }),
    ]);
    expect(brands).toBe(6);
    expect(settings).toBe(6);
    expect(invites).toBe(1);
    expect(owner.tenantId).toBe(tenantId);
    expect(owner.passwordHash).toBeNull(); // passwordless until invite accepted
  });

  it('rejects a duplicate slug with 409', async () => {
    const slug = uniqueSlug('dupe');
    const first = await provision({ slug, ownerEmail: `${slug}-1@owner.test` });
    expect(first.status).toBe(201);
    const second = await provision({ slug, ownerEmail: `${slug}-2@owner.test` });
    expect(second.status).toBe(409);
  });

  it('lists and fetches the provisioned tenant with usage metrics', async () => {
    const slug = uniqueSlug('listed');
    const prov = await provision({ slug });
    const tenantId = prov.body.data.tenant.id as string;

    const list = await request(app).get('/api/v1/platform/tenants').set(pAuth());
    expect(list.status).toBe(200);
    expect(list.body.data.some((t: { id: string }) => t.id === tenantId)).toBe(true);

    const detail = await request(app).get(`/api/v1/platform/tenants/${tenantId}`).set(pAuth());
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ id: tenantId, skuCount: 0, customerCount: 0, sales30d: 0 });
  });
});

// ─── Suspend / reactivate (session kill) ──────────────────────────────────────

describe('suspend / reactivate', () => {
  it('suspends a tenant, kills sessions, blocks login, then reactivates', async () => {
    const slug = uniqueSlug('susp');
    const prov = await provision({ slug, ownerEmail: `${slug}@owner.test` });
    const tenantId = prov.body.data.tenant.id as string;

    await prismaBase.user.update({
      where: { email: `${slug}@owner.test` },
      data: { passwordHash: await hashPassword('OwnerPass@123') },
    });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `${slug}@owner.test`, password: 'OwnerPass@123' });
    const refreshToken = login.body.data.refreshToken as string;

    // Suspend.
    const suspend = await request(app)
      .post(`/api/v1/platform/tenants/${tenantId}/suspend`)
      .set(pAuth());
    expect(suspend.status).toBe(200);
    expect(suspend.body.data.status).toBe('SUSPENDED');

    // Live session killed: refresh token revoked.
    const refresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refresh.status).toBe(401);

    // Fresh login blocked.
    const blocked = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `${slug}@owner.test`, password: 'OwnerPass@123' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('TENANT_SUSPENDED');

    // Reactivate restores access.
    const react = await request(app)
      .post(`/api/v1/platform/tenants/${tenantId}/reactivate`)
      .set(pAuth());
    expect(react.status).toBe(200);
    const ok = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `${slug}@owner.test`, password: 'OwnerPass@123' });
    expect(ok.status).toBe(200);

    // The lifecycle actions were audited.
    const audits = await prismaBase.platformAuditLog.findMany({ where: { tenantId } });
    const actions = audits.map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['PROVISION_TENANT', 'SUSPEND_TENANT', 'REACTIVATE_TENANT']));
  });
});

// ─── Impersonation ────────────────────────────────────────────────────────────

describe('impersonation', () => {
  it('issues a tenant-scoped token that sees only the target tenant', async () => {
    const provA = await provision({ slug: uniqueSlug('imp-a') });
    const provB = await provision({ slug: uniqueSlug('imp-b') });
    const tenantAId = provA.body.data.tenant.id as string;
    const tenantBId = provB.body.data.tenant.id as string;

    const impA = await request(app)
      .post(`/api/v1/platform/tenants/${tenantAId}/impersonate`)
      .set(pAuth());
    expect(impA.status).toBe(200);
    const tokenA = impA.body.data.accessToken as string;
    const authA = { Authorization: `Bearer ${tokenA}` };

    // Seed a product into tenant A *through* the impersonation session.
    const productType = await prismaBase.productType.findFirstOrThrow({ where: { name: 'Car Tyre' } });
    const create = await request(app)
      .post('/api/v1/products')
      .set(authA)
      .send({
        productTypeId: productType.id,
        name: 'Impersonated Tyre',
        variant: {
          sku: `IMP-${Date.now()}`,
          purchasePrice: 50,
          sellingPrice: 100,
          taxRatePct: 20,
          attributes: { size: '195/65 R15', tyre_type: 'Tubeless' },
          openingStock: 5,
          reorderLevel: 2,
        },
      });
    expect(create.status).toBe(201);

    // The product belongs to tenant A only.
    const dbProduct = await prismaBase.product.findUniqueOrThrow({ where: { id: create.body.data.id } });
    expect(dbProduct.tenantId).toBe(tenantAId);

    // Impersonating B sees none of A's products.
    const impB = await request(app)
      .post(`/api/v1/platform/tenants/${tenantBId}/impersonate`)
      .set(pAuth());
    const listB = await request(app)
      .get('/api/v1/products')
      .set({ Authorization: `Bearer ${impB.body.data.accessToken}` });
    expect(listB.body.data.every((p: { name: string }) => p.name !== 'Impersonated Tyre')).toBe(true);

    // An impersonation token cannot reach the platform endpoints.
    const denied = await request(app).get('/api/v1/platform/tenants').set(authA);
    expect(denied.status).toBe(403);
  });
});
