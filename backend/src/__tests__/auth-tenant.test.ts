/**
 * Phase 2A V-01: login resolves the tenant, embeds it in the access token,
 * blocks suspended tenants, and refresh preserves the tenant.
 *
 * Uses two throwaway tenants (one ACTIVE, one SUSPENDED) so it never touches the
 * default tenant the rest of the suite relies on.
 */
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';

const PASSWORD = 'TenantAuth@123';
const ACTIVE_EMAIL = 'active-tenant-user@tenant-test.local';
const SUSPENDED_EMAIL = 'suspended-tenant-user@tenant-test.local';

let activeTenantId: string;
let suspendedTenantId: string;

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const passwordHash = await hashPassword(PASSWORD);

  const activeTenant = await prisma.tenant.create({
    data: { name: 'Active Shop', slug: `active-${Date.now()}`, status: 'ACTIVE' },
  });
  const suspendedTenant = await prisma.tenant.create({
    data: { name: 'Suspended Shop', slug: `suspended-${Date.now()}`, status: 'SUSPENDED' },
  });
  activeTenantId = activeTenant.id;
  suspendedTenantId = suspendedTenant.id;

  await prisma.user.create({
    data: {
      tenantId: activeTenantId,
      email: ACTIVE_EMAIL,
      fullName: 'Active Tenant User',
      passwordHash,
      roleId: adminRole.id,
    },
  });
  await prisma.user.create({
    data: {
      tenantId: suspendedTenantId,
      email: SUSPENDED_EMAIL,
      fullName: 'Suspended Tenant User',
      passwordHash,
      roleId: adminRole.id,
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [ACTIVE_EMAIL, SUSPENDED_EMAIL] } },
  });
  await prisma.tenant.deleteMany({
    where: { id: { in: [activeTenantId, suspendedTenantId] } },
  });
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/login (tenant-aware)', () => {
  it('embeds tenantId in the access token and the user profile', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ACTIVE_EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.tenantId).toBe(activeTenantId);

    const decoded = jwt.decode(res.body.data.accessToken) as { tenantId?: string };
    expect(decoded.tenantId).toBe(activeTenantId);
  });

  it('blocks login for a suspended tenant with 403 TENANT_SUSPENDED', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: SUSPENDED_EMAIL, password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TENANT_SUSPENDED');
  });

  it('still rejects wrong credentials without leaking tenant status', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: SUSPENDED_EMAIL, password: 'WrongPass@1' });

    // Wrong password resolves before the suspension check → generic 401.
    expect(res.status).toBe(401);
    expect(res.body.error.code).not.toBe('TENANT_SUSPENDED');
  });

  it('preserves tenantId across a refresh', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ACTIVE_EMAIL, password: PASSWORD });
    const refreshToken = login.body.data.refreshToken as string;

    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    const decoded = jwt.decode(res.body.data.accessToken) as { tenantId?: string };
    expect(decoded.tenantId).toBe(activeTenantId);
  });
});
