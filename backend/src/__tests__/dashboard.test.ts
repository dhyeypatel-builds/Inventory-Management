/**
 * F-02 integration tests for /dashboard.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.dev.yml up -d
 *   npx prisma migrate deploy
 *   npx prisma db seed
 *
 * NOTE: dashboard endpoints aggregate global state and these suites run against
 * a shared DB in parallel, so assertions are framed as inequalities / presence
 * checks relative to this suite's own sale rather than exact totals.
 */

import request from 'supertest';
import { app } from '../app';
import { prisma } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';

const TEST_EMAIL = 'dashboard-test-user@tyrestock.test';
const TEST_PASSWORD = 'DashboardPass@99';

let accessToken: string;
let testUserId: string;

let productTypeId: number;
let brandId: number;
let variantId: string;
const SKU = 'TYR-DASH-MAIN';

const SELL_QTY = 7;
const UNIT_PRICE = 2000;
const TAX_PCT = 18;
const SALE_GRAND_TOTAL = SELL_QTY * UNIT_PRICE * (1 + TAX_PCT / 100); // 16520

const createdProductIds: string[] = [];
const createdSaleIds: string[] = [];

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

function today(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, failedLogins: 0, isActive: true },
    create: {
      email: TEST_EMAIL,
      fullName: 'Dashboard Test User',
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

  const prodRes = await request(app)
    .post('/api/v1/products')
    .set(auth())
    .send({
      productTypeId,
      brandId,
      name: 'Dashboard Test Tyre',
      variant: {
        sku: SKU,
        purchasePrice: 1000,
        sellingPrice: UNIT_PRICE,
        taxRatePct: TAX_PCT,
        attributes: { size: '195/65 R15', tyre_type: 'Tubeless' },
        openingStock: 100,
        reorderLevel: 5,
      },
    });
  expect(prodRes.status).toBe(201);
  createdProductIds.push(prodRes.body.data.id);
  variantId = prodRes.body.data.variants[0].id as string;

  // One confirmed sale to make this suite's contribution observable.
  // Concurrent sales from parallel suites contend on sequential invoice
  // numbering and get a retryable 409 CONFLICT (E-02 contract) — retry it.
  let saleRes;
  for (let attempt = 0; attempt < 6; attempt++) {
    saleRes = await request(app)
      .post('/api/v1/sales')
      .set(auth())
      .send({ paymentMode: 'CASH', items: [{ variantId, quantity: SELL_QTY }] });
    if (saleRes.body?.error?.code !== 'CONFLICT') break;
    await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
  }
  expect(saleRes!.status).toBe(201);
  createdSaleIds.push(saleRes!.body.data.id);
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

// ─── GET /dashboard/summary ─────────────────────────────────────────────────

describe('GET /api/v1/dashboard/summary', () => {
  it('returns KPI summary reflecting at least this suite\'s sale', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary').set(auth());
    expect(res.status).toBe(200);

    const data = res.body.data as {
      today: { salesCount: number; revenue: number };
      mtd: { salesCount: number; revenue: number };
      totalSkus: number;
      stockValue: number;
      openAlerts: number;
    };

    expect(data.today.salesCount).toBeGreaterThanOrEqual(1);
    expect(data.today.revenue).toBeGreaterThanOrEqual(SALE_GRAND_TOTAL);
    expect(data.mtd.salesCount).toBeGreaterThanOrEqual(data.today.salesCount);
    expect(data.mtd.revenue).toBeGreaterThanOrEqual(data.today.revenue);
    expect(data.totalSkus).toBeGreaterThan(0);
    expect(data.stockValue).toBeGreaterThanOrEqual(0);
    expect(data.openAlerts).toBeGreaterThanOrEqual(0);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
  });
});

// ─── GET /dashboard/sales-trend ─────────────────────────────────────────────

describe('GET /api/v1/dashboard/sales-trend', () => {
  it('returns a daily series including today with this suite\'s sale', async () => {
    const res = await request(app).get('/api/v1/dashboard/sales-trend?range=30').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.range).toBe(30);

    const series = res.body.data.series as {
      date: string;
      salesCount: number;
      revenue: number;
    }[];
    expect(Array.isArray(series)).toBe(true);

    const todayEntry = series.find((p) => p.date === today());
    expect(todayEntry).toBeDefined();
    expect(todayEntry!.salesCount).toBeGreaterThanOrEqual(1);
    expect(todayEntry!.revenue).toBeGreaterThanOrEqual(SALE_GRAND_TOTAL);
  });

  it('clamps an invalid range to the default (30)', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/sales-trend?range=abc')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.range).toBe(30);
  });
});

// ─── GET /dashboard/top-brands ──────────────────────────────────────────────

describe('GET /api/v1/dashboard/top-brands', () => {
  it('returns brand rankings including the brand we sold', async () => {
    const res = await request(app).get('/api/v1/dashboard/top-brands?limit=50').set(auth());
    expect(res.status).toBe(200);

    const rows = res.body.data as {
      brandName: string;
      units: number;
      revenue: number;
    }[];
    expect(Array.isArray(rows)).toBe(true);
    rows.forEach((r) => {
      expect(typeof r.brandName).toBe('string');
      expect(r.units).toBeGreaterThanOrEqual(0);
      expect(r.revenue).toBeGreaterThanOrEqual(0);
    });

    expect(rows.some((r) => r.brandName === 'MRF')).toBe(true);
  });
});

// ─── GET /dashboard/fast-moving ─────────────────────────────────────────────

describe('GET /api/v1/dashboard/fast-moving', () => {
  it('lists our sold variant with its units', async () => {
    const res = await request(app).get('/api/v1/dashboard/fast-moving?limit=50').set(auth());
    expect(res.status).toBe(200);

    const rows = res.body.data as {
      variantId: string;
      sku: string;
      units: number;
      revenue: number;
    }[];
    expect(Array.isArray(rows)).toBe(true);

    const mine = rows.find((r) => r.variantId === variantId);
    expect(mine).toBeDefined();
    expect(mine!.sku).toBe(SKU);
    expect(mine!.units).toBeGreaterThanOrEqual(SELL_QTY);
  });
});
