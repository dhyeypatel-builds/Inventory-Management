/**
 * F-01 integration tests for /alerts and stock-alert evaluation.
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

const TEST_EMAIL = 'alerts-test-user@tyrestock.test';
const TEST_PASSWORD = 'AlertsPass@99';

let accessToken: string;
let testUserId: string;

let productTypeId: number;
let brandId: number;

const createdProductIds: string[] = [];
const createdSaleIds: string[] = [];

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

async function createProductWithVariant(opts: {
  name: string;
  sku: string;
  size: string;
  openingStock: number;
  reorderLevel: number;
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
        sellingPrice: 1500,
        taxRatePct: 18,
        attributes: { size: opts.size, tyre_type: 'Tubeless' },
        openingStock: opts.openingStock,
        reorderLevel: opts.reorderLevel,
      },
    });
  expect(res.status).toBe(201);
  createdProductIds.push(res.body.data.id);
  return res.body.data.variants[0].id as string;
}

// Concurrent sales from parallel suites contend on sequential invoice
// numbering (Serializable isolation) and get a retryable 409 CONFLICT — the
// documented contract from E-02. Honor it by retrying.
async function sell(variantId: string, quantity: number): Promise<void> {
  let res;
  for (let attempt = 0; attempt < 6; attempt++) {
    res = await request(app)
      .post('/api/v1/sales')
      .set(auth())
      .send({ paymentMode: 'CASH', items: [{ variantId, quantity }] });
    if (res.body?.error?.code !== 'CONFLICT') break;
    await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
  }
  expect(res!.status).toBe(201);
  createdSaleIds.push(res!.body.data.id);
}

async function openAlertsFor(variantId: string) {
  const res = await request(app).get('/api/v1/alerts?status=OPEN').set(auth());
  expect(res.status).toBe(200);
  return (res.body.data as { variantId: string; type: string; id: string }[]).filter(
    (a) => a.variantId === variantId,
  );
}

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, failedLogins: 0, isActive: true },
    create: {
      email: TEST_EMAIL,
      fullName: 'Alerts Test User',
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
});

afterAll(async () => {
  await prisma.saleItem.deleteMany({ where: { saleId: { in: createdSaleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: createdSaleIds } } });

  for (const productId of createdProductIds) {
    const variants = await prisma.productVariant.findMany({ where: { productId } });
    const variantIds = variants.map((v) => v.id);
    if (variantIds.length > 0) {
      await prisma.alert.deleteMany({ where: { variantId: { in: variantIds } } });
      await prisma.stockMovement.deleteMany({ where: { variantId: { in: variantIds } } });
    }
    await prisma.product.delete({ where: { id: productId } }).catch(() => null);
  }
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);
  await prisma.$disconnect();
});

// ─── Evaluation on sale movements ───────────────────────────────────────────

describe('stock-alert evaluation', () => {
  it('raises a LOW_STOCK alert when a sale drops on-hand to the reorder level', async () => {
    const variantId = await createProductWithVariant({
      name: 'Alert Low Tyre',
      sku: 'TYR-ALERT-LOW',
      size: '195/65 R15',
      openingStock: 10,
      reorderLevel: 5,
    });

    await sell(variantId, 5); // 10 → 5 (≤ reorder)

    const open = await openAlertsFor(variantId);
    expect(open).toHaveLength(1);
    expect(open[0].type).toBe('LOW_STOCK');
  });

  it('does not create duplicate OPEN alerts while still below threshold', async () => {
    const variantId = await createProductWithVariant({
      name: 'Alert Dup Tyre',
      sku: 'TYR-ALERT-DUP',
      size: '205/55 R16',
      openingStock: 10,
      reorderLevel: 5,
    });

    await sell(variantId, 5); // 10 → 5  → LOW_STOCK OPEN

    // Another movement keeping it at/below threshold must not add a 2nd alert.
    const adjustRes = await request(app)
      .post(`/api/v1/inventory/${variantId}/adjust`)
      .set(auth())
      .send({ delta: -1, reason: 'Shrinkage' }); // 5 → 4
    expect(adjustRes.status).toBe(200);

    const open = await openAlertsFor(variantId);
    expect(open).toHaveLength(1);
    expect(open[0].type).toBe('LOW_STOCK');
  });

  it('escalates to OUT_OF_STOCK at zero and resolves the LOW_STOCK alert', async () => {
    const variantId = await createProductWithVariant({
      name: 'Alert Zero Tyre',
      sku: 'TYR-ALERT-ZERO',
      size: '165/80 R14',
      openingStock: 8,
      reorderLevel: 5,
    });

    await sell(variantId, 3); // 8 → 5 → LOW_STOCK
    await sell(variantId, 5); // 5 → 0 → OUT_OF_STOCK

    const open = await openAlertsFor(variantId);
    expect(open).toHaveLength(1);
    expect(open[0].type).toBe('OUT_OF_STOCK');

    // The earlier LOW_STOCK alert is no longer OPEN.
    const lowOpen = await prisma.alert.findFirst({
      where: { variantId, type: 'LOW_STOCK', status: 'OPEN' },
    });
    expect(lowOpen).toBeNull();
  });

  it('resolves the open alert when stock is replenished above threshold', async () => {
    const variantId = await createProductWithVariant({
      name: 'Alert Restock Tyre',
      sku: 'TYR-ALERT-RESTOCK',
      size: '145/80 R12',
      openingStock: 6,
      reorderLevel: 5,
    });

    await sell(variantId, 2); // 6 → 4 → LOW_STOCK
    expect(await openAlertsFor(variantId)).toHaveLength(1);

    const adjustRes = await request(app)
      .post(`/api/v1/inventory/${variantId}/adjust`)
      .set(auth())
      .send({ delta: 20, reason: 'Purchase received' }); // 4 → 24
    expect(adjustRes.status).toBe(200);

    expect(await openAlertsFor(variantId)).toHaveLength(0);
  });
});

// ─── GET /alerts ────────────────────────────────────────────────────────────

describe('GET /api/v1/alerts', () => {
  it('returns only OPEN alerts when filtered', async () => {
    const variantId = await createProductWithVariant({
      name: 'Alert List Tyre',
      sku: 'TYR-ALERT-LIST',
      size: '195/65 R15',
      openingStock: 7,
      reorderLevel: 5,
    });
    await sell(variantId, 2); // 7 → 5 → LOW_STOCK

    const res = await request(app).get('/api/v1/alerts?status=OPEN').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1 });
    (res.body.data as { status: string }[]).forEach((a) => expect(a.status).toBe('OPEN'));

    const mine = (res.body.data as { variantId: string; sku: string }[]).find(
      (a) => a.variantId === variantId,
    );
    expect(mine).toBeDefined();
    expect(mine!.sku).toBe('TYR-ALERT-LIST');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/alerts');
    expect(res.status).toBe(401);
  });
});

// ─── POST /alerts/:id/acknowledge ───────────────────────────────────────────

describe('POST /api/v1/alerts/:id/acknowledge', () => {
  it('acknowledges an OPEN alert and rejects a second acknowledge with 409', async () => {
    const variantId = await createProductWithVariant({
      name: 'Alert Ack Tyre',
      sku: 'TYR-ALERT-ACK',
      size: '205/55 R16',
      openingStock: 8,
      reorderLevel: 5,
    });
    await sell(variantId, 3); // 8 → 5 → LOW_STOCK

    const open = await openAlertsFor(variantId);
    expect(open).toHaveLength(1);
    const alertId = open[0].id;

    const ackRes = await request(app)
      .post(`/api/v1/alerts/${alertId}/acknowledge`)
      .set(auth());
    expect(ackRes.status).toBe(200);
    expect(ackRes.body.data.status).toBe('ACKNOWLEDGED');

    const againRes = await request(app)
      .post(`/api/v1/alerts/${alertId}/acknowledge`)
      .set(auth());
    expect(againRes.status).toBe(409);
  });

  it('returns 404 for an unknown alert id', async () => {
    const res = await request(app)
      .post('/api/v1/alerts/00000000-0000-0000-0000-000000000000/acknowledge')
      .set(auth());
    expect(res.status).toBe(404);
  });
});
