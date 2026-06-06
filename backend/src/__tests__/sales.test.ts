/**
 * E-02 integration tests for /sales.
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

const TEST_EMAIL = 'sales-test-user@tyrestock.test';
const TEST_PASSWORD = 'SalesPass@99';

let accessToken: string;
let testUserId: string;

let productTypeId: number;
let brandId: number;
let customerId: string;

// A well-stocked variant: openingStock 100, sellingPrice 2000, tax 18%.
let variantId: string;

const createdProductIds: string[] = [];
const createdSaleIds: string[] = [];

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

async function createProductWithVariant(opts: {
  name: string;
  sku: string;
  size: string;
  openingStock: number;
  sellingPrice: number;
  taxRatePct: number;
}): Promise<string> {
  const res = await request(app)
    .post('/api/v1/products')
    .set(auth())
    .send({
      productTypeId,
      brandId,
      name: opts.name,
      variant: {
        sku: opts.sku,
        purchasePrice: 1000,
        sellingPrice: opts.sellingPrice,
        taxRatePct: opts.taxRatePct,
        attributes: { size: opts.size, tyre_type: 'Tubeless' },
        openingStock: opts.openingStock,
        reorderLevel: 5,
      },
    });
  expect(res.status).toBe(201);
  createdProductIds.push(res.body.data.id);
  return res.body.data.variants[0].id as string;
}

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, failedLogins: 0, isActive: true },
    create: {
      email: TEST_EMAIL,
      fullName: 'Sales Test User',
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

  variantId = await createProductWithVariant({
    name: 'Sales Test Tyre',
    sku: 'TYR-SALE-MAIN',
    size: '195/65 R15',
    openingStock: 100,
    sellingPrice: 2000,
    taxRatePct: 18,
  });

  const custRes = await request(app)
    .post('/api/v1/customers')
    .set(auth())
    .send({ name: 'Sales Test Customer', phone: '+919000000001' });
  customerId = custRes.body.data.id as string;
});

afterAll(async () => {
  await prisma.saleItem.deleteMany({ where: { saleId: { in: createdSaleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: createdSaleIds } } });

  for (const productId of createdProductIds) {
    const variants = await prisma.productVariant.findMany({ where: { productId } });
    const variantIds = variants.map((v) => v.id);
    if (variantIds.length > 0) {
      // Selling to zero (the oversell test) raises stock alerts; clear them so
      // the variant FK doesn't block product deletion.
      await prisma.alert.deleteMany({ where: { variantId: { in: variantIds } } });
      await prisma.stockMovement.deleteMany({ where: { variantId: { in: variantIds } } });
    }
    await prisma.product.delete({ where: { id: productId } }).catch(() => null);
  }
  await prisma.customer.delete({ where: { id: customerId } }).catch(() => null);
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);
  await prisma.$disconnect();
});

// ─── POST /sales ──────────────────────────────────────────────────────────────

describe('POST /api/v1/sales', () => {
  it('creates a sale, deducts stock, writes a SALE movement, and computes totals', async () => {
    const before = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });

    const res = await request(app)
      .post('/api/v1/sales')
      .set(auth())
      .send({
        customerId,
        paymentMode: 'CASH',
        items: [{ variantId, quantity: 2 }],
      });

    expect(res.status).toBe(201);
    const sale = res.body.data;
    createdSaleIds.push(sale.id);

    // Totals: 2 × 2000 = 4000 subtotal; tax 18% = 720; grand 4720.
    expect(sale.subtotal).toBe(4000);
    expect(sale.discount).toBe(0);
    expect(sale.taxTotal).toBe(720);
    expect(sale.grandTotal).toBe(4720);
    expect(sale.invoiceNo).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(sale.items).toHaveLength(1);
    expect(sale.items[0].description).toContain('Sales Test Tyre');

    // Stock decremented.
    const after = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });
    expect(after.quantity).toBe(before.quantity - 2);

    // SALE movement written with correct delta and reference.
    const movement = await prisma.stockMovement.findFirst({
      where: { variantId, type: 'SALE', referenceId: sale.id },
    });
    expect(movement).not.toBeNull();
    expect(movement!.quantityDelta).toBe(-2);
    expect(movement!.balanceAfter).toBe(before.quantity - 2);
  });

  it('applies a per-line discount to totals', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set(auth())
      .send({
        paymentMode: 'BANK_TRANSFER',
        items: [{ variantId, quantity: 1, discount: 200 }],
      });

    expect(res.status).toBe(201);
    const sale = res.body.data;
    createdSaleIds.push(sale.id);

    // subtotal 2000, discount 200, taxable 1800, tax 18% = 324, grand 2124.
    expect(sale.subtotal).toBe(2000);
    expect(sale.discount).toBe(200);
    expect(sale.taxTotal).toBe(324);
    expect(sale.grandTotal).toBe(2124);
  });

  it('generates sequential invoice numbers', async () => {
    const r1 = await request(app)
      .post('/api/v1/sales')
      .set(auth())
      .send({ paymentMode: 'CASH', items: [{ variantId, quantity: 1 }] });
    const r2 = await request(app)
      .post('/api/v1/sales')
      .set(auth())
      .send({ paymentMode: 'CASH', items: [{ variantId, quantity: 1 }] });

    createdSaleIds.push(r1.body.data.id, r2.body.data.id);

    const seq1 = parseInt(r1.body.data.invoiceNo.split('-')[2], 10);
    const seq2 = parseInt(r2.body.data.invoiceNo.split('-')[2], 10);
    expect(seq2).toBe(seq1 + 1);
  });

  it('returns 409 INSUFFICIENT_STOCK and rolls back when stock is too low', async () => {
    const before = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });

    const res = await request(app)
      .post('/api/v1/sales')
      .set(auth())
      .send({
        paymentMode: 'CASH',
        items: [{ variantId, quantity: before.quantity + 50 }],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(Array.isArray(res.body.error.details)).toBe(true);

    // Stock unchanged (full rollback).
    const after = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });
    expect(after.quantity).toBe(before.quantity);
  });

  it('honors Idempotency-Key: a duplicate request returns the same sale', async () => {
    const key = `test-idem-${Date.now()}`;
    const before = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });

    const r1 = await request(app)
      .post('/api/v1/sales')
      .set(auth())
      .set('Idempotency-Key', key)
      .send({ paymentMode: 'CASH', items: [{ variantId, quantity: 3 }] });
    expect(r1.status).toBe(201);
    createdSaleIds.push(r1.body.data.id);

    const r2 = await request(app)
      .post('/api/v1/sales')
      .set(auth())
      .set('Idempotency-Key', key)
      .send({ paymentMode: 'CASH', items: [{ variantId, quantity: 3 }] });
    expect(r2.status).toBe(201);

    // Same sale returned; stock deducted only once.
    expect(r2.body.data.id).toBe(r1.body.data.id);
    expect(r2.body.data.invoiceNo).toBe(r1.body.data.invoiceNo);

    const after = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });
    expect(after.quantity).toBe(before.quantity - 3);
  });

  it('rejects an empty items array with 400', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set(auth())
      .send({ paymentMode: 'CASH', items: [] });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid payment mode with 400', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set(auth())
      .send({ paymentMode: 'BITCOIN', items: [{ variantId, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .send({ paymentMode: 'CASH', items: [{ variantId, quantity: 1 }] });
    expect(res.status).toBe(401);
  });
});

// ─── Concurrency: oversell prevention ─────────────────────────────────────────

describe('POST /api/v1/sales (concurrent oversell)', () => {
  it('prevents two concurrent sales from overselling the same variant', async () => {
    // Fresh variant with exactly 5 units; two requests each want all 5.
    const oversellVariantId = await createProductWithVariant({
      name: 'Oversell Tyre',
      sku: 'TYR-SALE-OVERSELL',
      size: '205/55 R16',
      openingStock: 5,
      sellingPrice: 1500,
      taxRatePct: 18,
    });

    const fire = () =>
      request(app)
        .post('/api/v1/sales')
        .set(auth())
        .send({ paymentMode: 'CASH', items: [{ variantId: oversellVariantId, quantity: 5 }] });

    const [a, b] = await Promise.all([fire(), fire()]);
    const statuses = [a.status, b.status].sort();

    // Exactly one succeeds (201); the other is rejected (409).
    expect(statuses).toEqual([201, 409]);

    for (const r of [a, b]) {
      if (r.status === 201) createdSaleIds.push(r.body.data.id);
    }

    // Never oversold below zero.
    const inv = await prisma.inventory.findUniqueOrThrow({ where: { variantId: oversellVariantId } });
    expect(inv.quantity).toBe(0);
  });
});

// ─── GET /sales and /sales/:id ────────────────────────────────────────────────

describe('GET /api/v1/sales', () => {
  it('lists sales filtered by customer', async () => {
    const res = await request(app).get(`/api/v1/sales?customerId=${customerId}`).set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    (res.body.data as { customerId: string }[]).forEach((s) =>
      expect(s.customerId).toBe(customerId),
    );
  });

  it('returns sale detail by id', async () => {
    const res = await request(app).get(`/api/v1/sales/${createdSaleIds[0]}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdSaleIds[0]);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('returns 404 for an unknown sale', async () => {
    const res = await request(app)
      .get('/api/v1/sales/00000000-0000-0000-0000-000000000000')
      .set(auth());
    expect(res.status).toBe(404);
  });
});

// ─── Customer history reflects sales (E-01 acceptance) ────────────────────────

describe('GET /api/v1/customers/:id (history after sales)', () => {
  it('includes the created sales in recentSales', async () => {
    const res = await request(app).get(`/api/v1/customers/${customerId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.recentSales.length).toBeGreaterThanOrEqual(1);
    const invoiceNos = (res.body.data.recentSales as { invoiceNo: string }[]).map(
      (s) => s.invoiceNo,
    );
    expect(invoiceNos.every((n) => /^INV-\d{4}-\d{6}$/.test(n))).toBe(true);
  });
});
