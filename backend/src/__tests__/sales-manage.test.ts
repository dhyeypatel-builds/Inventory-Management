/**
 * E-03 integration tests for /sales cancel, return, and invoice.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.dev.yml up -d
 *   npx prisma migrate deploy
 *   npx prisma db seed
 */

import request from 'supertest';
import { app } from '../app';
import { prisma } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';

const TEST_EMAIL = 'sales-manage-test@tyrestock.test';
const TEST_PASSWORD = 'ManagePass@99';

let accessToken: string;
let testUserId: string;
let productTypeId: number;
let brandId: number;

// Two variants: one per "sub-area" of tests to keep them independent.
let variantA: string; // used by cancel + invoice tests
let variantB: string; // used by return tests

const createdProductIds: string[] = [];
const createdSaleIds: string[] = [];

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

async function makeVariant(name: string, sku: string, stock = 50): Promise<string> {
  const res = await request(app)
    .post('/api/v1/products')
    .set(auth())
    .send({
      productTypeId,
      brandId,
      name,
      variant: {
        sku,
        purchasePrice: 800,
        sellingPrice: 1500,
        taxRatePct: 18,
        attributes: { size: '195/65 R15', tyre_type: 'Tubeless' },
        openingStock: stock,
        reorderLevel: 5,
      },
    });
  expect(res.status).toBe(201);
  createdProductIds.push(res.body.data.id);
  return res.body.data.variants[0].id as string;
}

async function makeSale(variantId: string, qty: number, customerId?: string): Promise<string> {
  const body: Record<string, unknown> = {
    paymentMode: 'CASH',
    items: [{ variantId, quantity: qty }],
  };
  if (customerId) body.customerId = customerId;

  const res = await request(app).post('/api/v1/sales').set(auth()).send(body);
  expect(res.status).toBe(201);
  createdSaleIds.push(res.body.data.id);
  return res.body.data.id as string;
}

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, failedLogins: 0, isActive: true },
    create: {
      email: TEST_EMAIL,
      fullName: 'Sales Manage Test User',
      passwordHash,
      roleId: adminRole.id,
    },
  });
  testUserId = user.id;

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  accessToken = loginRes.body.data.accessToken as string;

  const carTyre = await prisma.productType.findUniqueOrThrow({ where: { name: 'Car Tyre' } });
  productTypeId = carTyre.id;
  const mrf = await prisma.brand.findFirstOrThrow({ where: { name: 'MRF', deletedAt: null } });
  brandId = mrf.id;

  variantA = await makeVariant('Cancel Invoice Tyre', 'TYR-MGT-A', 50);
  variantB = await makeVariant('Return Tyre',        'TYR-MGT-B', 50);
});

afterAll(async () => {
  await prisma.saleItem.deleteMany({ where: { saleId: { in: createdSaleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: createdSaleIds } } });

  for (const productId of createdProductIds) {
    const variants = await prisma.productVariant.findMany({ where: { productId } });
    const variantIds = variants.map((v) => v.id);
    if (variantIds.length) {
      await prisma.stockMovement.deleteMany({ where: { variantId: { in: variantIds } } });
    }
    await prisma.product.delete({ where: { id: productId } }).catch(() => null);
  }
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);
  await prisma.$disconnect();
});

// ─── POST /sales/:id/cancel ───────────────────────────────────────────────────

describe('POST /api/v1/sales/:id/cancel', () => {
  it('cancels a CONFIRMED sale and restocks all items', async () => {
    const saleId = await makeSale(variantA, 4);
    const before = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variantA } });

    const res = await request(app).post(`/api/v1/sales/${saleId}/cancel`).set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');

    // Stock restored.
    const after = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variantA } });
    expect(after.quantity).toBe(before.quantity + 4);

    // SALE_RETURN movement written.
    const movement = await prisma.stockMovement.findFirst({
      where: { variantId: variantA, type: 'SALE_RETURN', referenceId: saleId },
    });
    expect(movement).not.toBeNull();
    expect(movement!.quantityDelta).toBe(4);
    expect(movement!.balanceAfter).toBe(after.quantity);
  });

  it('rejects a double-cancel with 409', async () => {
    const saleId = await makeSale(variantA, 2);

    // First cancel succeeds.
    await request(app).post(`/api/v1/sales/${saleId}/cancel`).set(auth());

    // Second cancel rejected.
    const res = await request(app).post(`/api/v1/sales/${saleId}/cancel`).set(auth());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects cancelling a RETURNED sale with 409', async () => {
    const saleId = await makeSale(variantB, 1);
    await request(app).post(`/api/v1/sales/${saleId}/return`).set(auth()).send({});

    const res = await request(app).post(`/api/v1/sales/${saleId}/cancel`).set(auth());
    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown sale', async () => {
    const res = await request(app)
      .post('/api/v1/sales/00000000-0000-0000-0000-000000000000/cancel')
      .set(auth());
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const saleId = await makeSale(variantA, 1);
    const res = await request(app).post(`/api/v1/sales/${saleId}/cancel`);
    expect(res.status).toBe(401);
  });
});

// ─── POST /sales/:id/return ───────────────────────────────────────────────────

describe('POST /api/v1/sales/:id/return', () => {
  it('returns all items when no items body is provided', async () => {
    const saleId = await makeSale(variantB, 5);
    const before = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variantB } });

    const res = await request(app).post(`/api/v1/sales/${saleId}/return`).set(auth()).send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RETURNED');

    const after = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variantB } });
    expect(after.quantity).toBe(before.quantity + 5);

    const movement = await prisma.stockMovement.findFirst({
      where: { variantId: variantB, type: 'SALE_RETURN', referenceId: saleId },
    });
    expect(movement).not.toBeNull();
    expect(movement!.quantityDelta).toBe(5);
  });

  it('returns a partial quantity and restocks only that amount', async () => {
    const saleId = await makeSale(variantB, 6);
    const before = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variantB } });

    const res = await request(app)
      .post(`/api/v1/sales/${saleId}/return`)
      .set(auth())
      .send({ items: [{ variantId: variantB, quantity: 2 }] });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RETURNED');

    // Only 2 units restocked.
    const after = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variantB } });
    expect(after.quantity).toBe(before.quantity + 2);

    const movement = await prisma.stockMovement.findFirst({
      where: { variantId: variantB, type: 'SALE_RETURN', referenceId: saleId },
    });
    expect(movement).not.toBeNull();
    expect(movement!.quantityDelta).toBe(2);
  });

  it('rejects a return quantity exceeding sold quantity with 400', async () => {
    const saleId = await makeSale(variantB, 3);

    const res = await request(app)
      .post(`/api/v1/sales/${saleId}/return`)
      .set(auth())
      .send({ items: [{ variantId: variantB, quantity: 99 }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects returning a variant not in the sale with 400', async () => {
    const saleId = await makeSale(variantB, 1);

    const res = await request(app)
      .post(`/api/v1/sales/${saleId}/return`)
      .set(auth())
      .send({ items: [{ variantId: variantA, quantity: 1 }] });

    expect(res.status).toBe(400);
  });

  it('rejects a double-return with 409', async () => {
    const saleId = await makeSale(variantB, 2);
    await request(app).post(`/api/v1/sales/${saleId}/return`).set(auth()).send({});

    const res = await request(app).post(`/api/v1/sales/${saleId}/return`).set(auth()).send({});
    expect(res.status).toBe(409);
  });
});

// ─── GET /sales/:id/invoice ───────────────────────────────────────────────────

describe('GET /api/v1/sales/:id/invoice', () => {
  it('returns a printable invoice payload with all required fields', async () => {
    const custRes = await request(app)
      .post('/api/v1/customers')
      .set(auth())
      .send({ name: 'Invoice Customer', phone: '+447700900001', vatNumber: 'GB123456789' });
    const customerId = custRes.body.data.id as string;

    const saleId = await makeSale(variantA, 2, customerId);

    const res = await request(app).get(`/api/v1/sales/${saleId}/invoice`).set(auth());

    expect(res.status).toBe(200);
    const inv = res.body.data;

    // Header fields.
    expect(inv.invoiceNo).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(inv.status).toBe('CONFIRMED');
    expect(inv.paymentMode).toBe('CASH');

    // Company section from settings.
    expect(inv.company).toBeDefined();
    expect(typeof inv.company.name).toBe('string');

    // Customer section.
    expect(inv.customer.name).toBe('Invoice Customer');
    expect(inv.customer.vatNumber).toBe('GB123456789');

    // Line items.
    expect(Array.isArray(inv.items)).toBe(true);
    expect(inv.items).toHaveLength(1);
    expect(inv.items[0]).toMatchObject({
      quantity: 2,
      unitPrice: 1500,
      taxRatePct: 18,
    });
    expect(typeof inv.items[0].sku).toBe('string');

    // Totals.
    // 2 × 1500 = 3000; tax 18% = 540; grand 3540.
    expect(inv.subtotal).toBe(3000);
    expect(inv.taxTotal).toBe(540);
    expect(inv.grandTotal).toBe(3540);

    // Cleanup customer.
    await prisma.customer.update({ where: { id: customerId }, data: { deletedAt: new Date() } });
  });

  it('returns 404 for an unknown sale', async () => {
    const res = await request(app)
      .get('/api/v1/sales/00000000-0000-0000-0000-000000000000/invoice')
      .set(auth());
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const saleId = createdSaleIds[0];
    const res = await request(app).get(`/api/v1/sales/${saleId}/invoice`);
    expect(res.status).toBe(401);
  });
});
