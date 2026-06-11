/**
 * Staff-role journeys — exercises the app with SALES and AUDITOR tokens, where
 * permission bugs live. Also covers the sale:override_price gate (ADMIN may
 * change a unit price at the till; SALES may not) and raw-data export access.
 */
import request from 'supertest';
import { app } from '../app';
import { prismaBase } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';

const PASSWORD = 'Staff@12345';
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

let tenantId: string;
let ownerToken: string;
let salesToken: string;
let auditorToken: string;
let variantId: string;
let sellingPrice: number;

async function loginAs(email: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data.accessToken as string;
}

beforeAll(async () => {
  const slug = `rbac-${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
  const tenant = await prismaBase.tenant.create({
    data: { name: 'RBAC Shop', slug, status: 'ACTIVE', onboardingCompletedAt: new Date() },
  });
  tenantId = tenant.id;

  const passwordHash = await hashPassword(PASSWORD);
  const roles = await prismaBase.role.findMany({ where: { name: { in: ['ADMIN', 'SALES', 'AUDITOR'] } } });
  const roleId = (name: string) => roles.find((r) => r.name === name)!.id;

  await prismaBase.user.createMany({
    data: [
      { tenantId, email: `${slug}-owner@rbac.test`, fullName: 'Owner', passwordHash, roleId: roleId('ADMIN') },
      { tenantId, email: `${slug}-sales@rbac.test`, fullName: 'Till Staff', passwordHash, roleId: roleId('SALES') },
      { tenantId, email: `${slug}-auditor@rbac.test`, fullName: 'Auditor', passwordHash, roleId: roleId('AUDITOR') },
    ],
  });

  ownerToken = await loginAs(`${slug}-owner@rbac.test`);
  salesToken = await loginAs(`${slug}-sales@rbac.test`);
  auditorToken = await loginAs(`${slug}-auditor@rbac.test`);

  // Owner sets up a brand + product with stock through the API (tenant-scoped).
  const brandRes = await request(app)
    .post('/api/v1/brands')
    .set(bearer(ownerToken))
    .send({ name: 'RBAC Brand' });
  expect(brandRes.status).toBe(201);

  const productType = await prismaBase.productType.findFirstOrThrow();
  sellingPrice = 100;
  const productRes = await request(app)
    .post('/api/v1/products')
    .set(bearer(ownerToken))
    .send({
      productTypeId: productType.id,
      brandId: brandRes.body.data.id,
      name: 'RBAC Tyre',
      variant: {
        sku: `RBAC-${Date.now()}`,
        purchasePrice: 50,
        sellingPrice,
        taxRatePct: 0,
        attributes: { size: '195/65 R15', tyre_type: 'Tubeless' },
        openingStock: 50,
        reorderLevel: 5,
      },
    });
  expect(productRes.status).toBe(201);
  variantId = productRes.body.data.variants[0].id as string;
});

afterAll(async () => {
  await prismaBase.tenant.delete({ where: { id: tenantId } }).catch(() => null);
  await prismaBase.$disconnect();
});

describe('SALES role', () => {
  it('can search stock and sell at the listed price', async () => {
    const search = await request(app)
      .get('/api/v1/variants?q=RBAC')
      .set(bearer(salesToken));
    expect(search.status).toBe(200);
    expect(search.body.data.some((v: { id: string }) => v.id === variantId)).toBe(true);

    const sale = await request(app)
      .post('/api/v1/sales')
      .set(bearer(salesToken))
      .send({ paymentMode: 'CASH', items: [{ variantId, quantity: 1 }] });
    expect(sale.status).toBe(201);
    expect(Number(sale.body.data.grandTotal)).toBe(sellingPrice);
  });

  it('cannot override the unit price (403), even via explicit unitPrice', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set(bearer(salesToken))
      .send({ paymentMode: 'CASH', items: [{ variantId, quantity: 1, unitPrice: 0 }] });
    expect(res.status).toBe(403);
  });

  it('may send unitPrice equal to the listed price (no-op override is fine)', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set(bearer(salesToken))
      .send({ paymentMode: 'CASH', items: [{ variantId, quantity: 1, unitPrice: sellingPrice }] });
    expect(res.status).toBe(201);
  });

  it('is denied reports, settings, team, and raw exports', async () => {
    for (const path of ['/api/v1/reports/sales', '/api/v1/settings', '/api/v1/team', '/api/v1/exports/customers']) {
      const res = await request(app).get(path).set(bearer(salesToken));
      expect({ path, status: res.status }).toEqual({ path, status: 403 });
    }
  });
});

describe('ADMIN role', () => {
  it('can override the unit price (sale:override_price)', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set(bearer(ownerToken))
      .send({ paymentMode: 'CASH', items: [{ variantId, quantity: 1, unitPrice: 80 }] });
    expect(res.status).toBe(201);
    expect(Number(res.body.data.grandTotal)).toBe(80);
  });

  it('can export raw data as CSV (and it contains this tenant\'s sales only)', async () => {
    const res = await request(app).get('/api/v1/exports/sales').set(bearer(ownerToken));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('invoice_no');
    expect(res.text).toContain('RBAC Tyre');

    // Unknown entity → 400, not a crash.
    const bad = await request(app).get('/api/v1/exports/everything').set(bearer(ownerToken));
    expect(bad.status).toBe(400);
  });
});

describe('AUDITOR role', () => {
  it('reads sales but cannot create them', async () => {
    const list = await request(app).get('/api/v1/sales').set(bearer(auditorToken));
    expect(list.status).toBe(200);

    const create = await request(app)
      .post('/api/v1/sales')
      .set(bearer(auditorToken))
      .send({ paymentMode: 'CASH', items: [{ variantId, quantity: 1 }] });
    expect(create.status).toBe(403);
  });

  it('can export raw data (report:export)', async () => {
    const res = await request(app).get('/api/v1/exports/inventory').set(bearer(auditorToken));
    expect(res.status).toBe(200);
    expect(res.text).toContain('RBAC Tyre');
  });
});
