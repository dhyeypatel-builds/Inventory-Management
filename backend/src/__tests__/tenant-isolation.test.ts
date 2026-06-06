/**
 * Phase 2A U-05 — cross-tenant isolation. THE security gate for the phase.
 *
 * Two tenants (A and B) each create their own catalog, customers and sales over
 * the real HTTP stack. Every assertion proves one tenant cannot see, fetch, or
 * aggregate another's data — across the Prisma query API (products, customers,
 * inventory, sales) AND the hand-scoped raw SQL (dashboard, reports). It also
 * verifies child rows (sale_items, variant attribute values) are stamped with
 * the correct tenant, and that invoice numbers sequence per-tenant (U-04).
 */
import request from 'supertest';
import { app } from '../app';
import { prismaBase } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';

const PASSWORD = 'Isolation@123';
const EMAIL_A = 'iso-a@tenant-test.local';
const EMAIL_B = 'iso-b@tenant-test.local';

let productTypeId: number;
let tenantAId: string;
let tenantBId: string;
let tokenA: string;
let tokenB: string;
let variantA: string;
let variantB: string;
let productAId: string;
let productBId: string;

const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

async function provisionTenant(name: string, email: string) {
  const role = await prismaBase.role.findFirstOrThrow({ where: { name: 'ADMIN' } });
  const tenant = await prismaBase.tenant.create({
    data: { name, slug: `${name}-${Date.now()}`, status: 'ACTIVE' },
  });
  await prismaBase.user.create({
    data: {
      tenantId: tenant.id,
      email,
      fullName: name,
      passwordHash: await hashPassword(PASSWORD),
      roleId: role.id,
    },
  });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  expect(login.status).toBe(200);
  return { id: tenant.id as string, token: login.body.data.accessToken as string };
}

async function createProduct(token: string, sku: string) {
  const res = await request(app)
    .post('/api/v1/products')
    .set(bearer(token))
    .send({
      productTypeId,
      name: `Tyre ${sku}`,
      variant: {
        sku,
        purchasePrice: 100,
        sellingPrice: 200,
        taxRatePct: 20,
        attributes: { size: '195/65 R15', tyre_type: 'Tubeless' },
        openingStock: 10,
        reorderLevel: 3,
      },
    });
  expect(res.status).toBe(201);
  return { productId: res.body.data.id as string, variantId: res.body.data.variants[0].id as string };
}

async function createSale(token: string, variantId: string, customerId?: string) {
  const body: Record<string, unknown> = { paymentMode: 'CASH', items: [{ variantId, quantity: 2 }] };
  if (customerId) body.customerId = customerId;
  const res = await request(app).post('/api/v1/sales').set(bearer(token)).send(body);
  expect(res.status).toBe(201);
  return res.body.data;
}

beforeAll(async () => {
  const carTyre = await prismaBase.productType.findFirstOrThrow({ where: { name: 'Car Tyre' } });
  productTypeId = carTyre.id;

  const a = await provisionTenant('iso-a', EMAIL_A);
  const b = await provisionTenant('iso-b', EMAIL_B);
  tenantAId = a.id;
  tenantBId = b.id;
  tokenA = a.token;
  tokenB = b.token;

  const pa = await createProduct(tokenA, 'ISO-A-SKU-1');
  const pb = await createProduct(tokenB, 'ISO-B-SKU-1');
  productAId = pa.productId;
  productBId = pb.productId;
  variantA = pa.variantId;
  variantB = pb.variantId;
});

afterAll(async () => {
  // Tenant FK cascade removes all scoped rows (users, products, variants,
  // inventory, sales, sale_items, customers, ...).
  await prismaBase.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  await prismaBase.$disconnect();
});

describe('catalog isolation', () => {
  it('each tenant lists only its own products', async () => {
    const a = await request(app).get('/api/v1/products').set(bearer(tokenA));
    const b = await request(app).get('/api/v1/products').set(bearer(tokenB));

    const aNames = (a.body.data as { name: string }[]).map((p) => p.name);
    const bNames = (b.body.data as { name: string }[]).map((p) => p.name);

    expect(aNames).toContain('Tyre ISO-A-SKU-1');
    expect(aNames).not.toContain('Tyre ISO-B-SKU-1');
    expect(bNames).toContain('Tyre ISO-B-SKU-1');
    expect(bNames).not.toContain('Tyre ISO-A-SKU-1');
  });

  it('a tenant cannot fetch another tenant\'s product by id (404)', async () => {
    const res = await request(app).get(`/api/v1/products/${productBId}`).set(bearer(tokenA));
    expect(res.status).toBe(404);
  });

  it('each tenant sees only its own inventory', async () => {
    const a = await request(app).get('/api/v1/inventory').set(bearer(tokenA));
    const variantIds = (a.body.data as { variantId: string }[]).map((i) => i.variantId);
    expect(variantIds).toContain(variantA);
    expect(variantIds).not.toContain(variantB);
  });
});

describe('customer + sales isolation', () => {
  it('each tenant sees only its own customers', async () => {
    await request(app)
      .post('/api/v1/customers')
      .set(bearer(tokenA))
      .send({ name: 'Alice A', phone: '+447700900100' });
    await request(app)
      .post('/api/v1/customers')
      .set(bearer(tokenB))
      .send({ name: 'Bob B', phone: '+447700900200' });

    const a = await request(app).get('/api/v1/customers').set(bearer(tokenA));
    const names = (a.body.data as { name: string }[]).map((c) => c.name);
    expect(names).toContain('Alice A');
    expect(names).not.toContain('Bob B');
  });

  it('invoice numbers sequence per-tenant (both start at 000001)', async () => {
    const saleA = await createSale(tokenA, variantA);
    const saleB = await createSale(tokenB, variantB);

    expect(saleA.invoiceNo.endsWith('-000001')).toBe(true);
    expect(saleB.invoiceNo.endsWith('-000001')).toBe(true);

    const a = await request(app).get('/api/v1/sales').set(bearer(tokenA));
    const aInvoices = a.body.data.map((s: { invoiceNo: string }) => s.invoiceNo);
    expect(aInvoices).toContain(saleA.invoiceNo);
    expect(a.body.data.every((s: { id: string }) => s.id !== saleB.id)).toBe(true);
  });

  it('child rows (sale_items) are stamped with the correct tenant', async () => {
    const aItems = await prismaBase.saleItem.findMany({ where: { tenantId: tenantAId } });
    const bItems = await prismaBase.saleItem.findMany({ where: { tenantId: tenantBId } });
    expect(aItems.length).toBeGreaterThan(0);
    expect(bItems.length).toBeGreaterThan(0);

    // No sale_item leaked into the default tenant via a nested create.
    const aVariantIds = new Set(aItems.map((i) => i.variantId));
    expect(aVariantIds.has(variantA)).toBe(true);
    expect(aVariantIds.has(variantB)).toBe(false);

    // Variant attribute values likewise carry the owning tenant.
    const vavA = await prismaBase.variantAttributeValue.findMany({ where: { variantId: variantA } });
    expect(vavA.length).toBeGreaterThan(0);
    expect(vavA.every((v) => v.tenantId === tenantAId)).toBe(true);
  });
});

describe('aggregate isolation (raw SQL: dashboard + reports)', () => {
  it('dashboard totalSkus counts only the caller tenant', async () => {
    const a = await request(app).get('/api/v1/dashboard/summary').set(bearer(tokenA));
    const b = await request(app).get('/api/v1/dashboard/summary').set(bearer(tokenB));
    expect(a.body.data.totalSkus).toBe(1);
    expect(b.body.data.totalSkus).toBe(1);
  });

  it('sales report contains only the caller tenant\'s invoices', async () => {
    const a = await request(app).get('/api/v1/reports/sales').set(bearer(tokenA));
    const invoices = a.body.data.rows.map((r: { invoiceNo: string }) => r.invoiceNo);
    // Exactly one sale was created in tenant A during this suite.
    expect(invoices.length).toBe(1);
    expect(a.body.data.summary.salesCount).toBe(1);
  });
});
