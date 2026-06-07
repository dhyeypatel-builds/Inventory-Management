/**
 * Phase 2C ON-01/ON-03 — complete onboarding + per-tenant demo seed.
 */
import request from 'supertest';
import { app } from '../app';
import { prismaBase } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';
import { setTransport } from '../email';
import type { EmailMessage, EmailTransport } from '../email/types';

class Capture implements EmailTransport {
  readonly name = 'cap';
  sent: EmailMessage[] = [];
  async send(m: EmailMessage): Promise<void> {
    this.sent.push(m);
  }
}

const PASSWORD = 'Onboard@123';
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
let capture: Capture;
const tenantIds: string[] = [];

async function makeOwner(name: string) {
  const role = await prismaBase.role.findFirstOrThrow({ where: { name: 'ADMIN' } });
  const tenant = await prismaBase.tenant.create({
    data: { name, slug: `onb-${Date.now()}-${Math.floor(Math.random() * 1e5)}`, status: 'ACTIVE' },
  });
  tenantIds.push(tenant.id);
  const email = `${tenant.slug}@onboard.test`;
  await prismaBase.user.create({
    data: { tenantId: tenant.id, email, fullName: name, passwordHash: await hashPassword(PASSWORD), roleId: role.id },
  });
  // Provisioned tenants get the 6 starter brands; mirror that for demo seeding.
  await prismaBase.brand.createMany({
    data: ['Michelin', 'Bridgestone', 'Continental', 'Goodyear', 'Pirelli', 'Dunlop'].map((n) => ({ tenantId: tenant.id, name: n })),
  });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  return { tenantId: tenant.id, email, token: login.body.data.accessToken as string };
}

beforeEach(() => {
  capture = new Capture();
  setTransport(capture);
});

afterAll(async () => {
  setTransport(null);
  await prismaBase.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await prismaBase.$disconnect();
});

describe('POST /onboarding/complete', () => {
  it('marks the tenant onboarded and emails a welcome', async () => {
    const owner = await makeOwner('Onboarder');

    const res = await request(app).post('/api/v1/onboarding/complete').set(bearer(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.data.onboardingCompletedAt).toBeTruthy();

    const tenant = await prismaBase.tenant.findUnique({ where: { id: owner.tenantId } });
    expect(tenant?.onboardingCompletedAt).not.toBeNull();
    expect(capture.sent.some((m) => m.to === owner.email && /live on TyreStock/i.test(m.subject))).toBe(true);

    const me = await request(app).get('/api/v1/auth/me').set(bearer(owner.token));
    expect(me.body.data.onboardingCompletedAt).toBeTruthy();
  });
});

describe('POST /onboarding/demo-seed', () => {
  it('populates the tenant, is idempotent, and clears', async () => {
    const owner = await makeOwner('Demoer');

    const seed = await request(app).post('/api/v1/onboarding/demo-seed').set(bearer(owner.token));
    expect(seed.status).toBe(200);
    expect(seed.body.data).toMatchObject({ seeded: true, products: 5, customers: 2 });

    const products = await prismaBase.product.count({ where: { tenantId: owner.tenantId, description: 'demo-seed' } });
    expect(products).toBe(5);

    // Re-running is a no-op.
    const again = await request(app).post('/api/v1/onboarding/demo-seed').set(bearer(owner.token));
    expect(again.body.data.seeded).toBe(false);

    // Clear soft-deletes the demo data.
    const clear = await request(app).post('/api/v1/onboarding/demo-seed/clear').set(bearer(owner.token));
    expect(clear.body.data.products).toBe(5);
    const live = await prismaBase.product.count({ where: { tenantId: owner.tenantId, description: 'demo-seed', deletedAt: null } });
    expect(live).toBe(0);
  });

  it('demo data is tenant-scoped (not visible to another tenant)', async () => {
    const a = await makeOwner('DemoA');
    const b = await makeOwner('DemoB');
    await request(app).post('/api/v1/onboarding/demo-seed').set(bearer(a.token));

    const listB = await request(app).get('/api/v1/products').set(bearer(b.token));
    expect((listB.body.data as { name: string }[]).length).toBe(0);
  });
});
