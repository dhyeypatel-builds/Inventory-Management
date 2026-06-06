/**
 * F-03 integration tests for /reports and CSV/PDF export.
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

const TEST_EMAIL = 'reports-test-user@tyrestock.test';
const TEST_PASSWORD = 'ReportsPass@99';

let accessToken: string;
let testUserId: string;

let productTypeId: number;
let brandId: number;
let soldVariantId: string;
const SOLD_SKU = 'TYR-RPT-SOLD';
const LOW_SKU = 'TYR-RPT-LOW';

const SELL_QTY = 2;
const UNIT_PRICE = 2000;
const TAX_PCT = 18;
const EXPECTED_TAXABLE = SELL_QTY * UNIT_PRICE; // 4000
const EXPECTED_TAX = (EXPECTED_TAXABLE * TAX_PCT) / 100; // 720
const EXPECTED_GRAND = EXPECTED_TAXABLE + EXPECTED_TAX; // 4720

const createdProductIds: string[] = [];
const createdSaleIds: string[] = [];

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

async function createProductWithVariant(opts: {
  name: string;
  sku: string;
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
        sellingPrice: UNIT_PRICE,
        taxRatePct: TAX_PCT,
        attributes: { size: '195/65 R15', tyre_type: 'Tubeless' },
        openingStock: opts.openingStock,
        reorderLevel: opts.reorderLevel,
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
    create: { email: TEST_EMAIL, fullName: 'Reports Test User', passwordHash, roleId: adminRole.id },
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

  soldVariantId = await createProductWithVariant({
    name: 'Reports Sold Tyre',
    sku: SOLD_SKU,
    openingStock: 100,
    reorderLevel: 5,
  });

  // A variant that is below its reorder level (for the low-stock report).
  await createProductWithVariant({
    name: 'Reports Low Tyre',
    sku: LOW_SKU,
    openingStock: 2,
    reorderLevel: 5,
  });

  const saleRes = await request(app)
    .post('/api/v1/sales')
    .set(auth())
    .send({ paymentMode: 'CASH', items: [{ variantId: soldVariantId, quantity: SELL_QTY }] });
  expect(saleRes.status).toBe(201);
  createdSaleIds.push(saleRes.body.data.id);
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

// ─── JSON reports ─────────────────────────────────────────────────────────────

describe('GET /api/v1/reports/:name', () => {
  it('sales report returns columns, rows, and summary including our sale', async () => {
    const res = await request(app).get('/api/v1/reports/sales').set(auth());
    expect(res.status).toBe(200);

    const data = res.body.data;
    expect(Array.isArray(data.columns)).toBe(true);
    expect(Array.isArray(data.rows)).toBe(true);
    expect(data.summary.salesCount).toBeGreaterThanOrEqual(1);
    expect(data.summary.grandTotal).toBeGreaterThanOrEqual(EXPECTED_GRAND);

    const ours = (data.rows as { grandTotal: number }[]).find(
      (r) => r.grandTotal === EXPECTED_GRAND,
    );
    expect(ours).toBeDefined();
  });

  it('sales report honors the date filter (future range yields no rows)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/sales?from=2099-01-01&to=2099-12-31')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(0);
    expect(res.body.data.summary.salesCount).toBe(0);
  });

  it('fast-moving report lists the sold variant', async () => {
    const res = await request(app).get('/api/v1/reports/fast-moving').set(auth());
    expect(res.status).toBe(200);
    const ours = (res.body.data.rows as { sku: string; units: number }[]).find(
      (r) => r.sku === SOLD_SKU,
    );
    expect(ours).toBeDefined();
    expect(ours!.units).toBeGreaterThanOrEqual(SELL_QTY);
  });

  it('best-selling-brands report includes MRF', async () => {
    const res = await request(app).get('/api/v1/reports/best-selling-brands').set(auth());
    expect(res.status).toBe(200);
    expect((res.body.data.rows as { brandName: string }[]).some((r) => r.brandName === 'MRF')).toBe(
      true,
    );
  });

  it('low-stock report lists the below-reorder variant', async () => {
    const res = await request(app).get('/api/v1/reports/low-stock').set(auth());
    expect(res.status).toBe(200);
    const ours = (res.body.data.rows as { sku: string; onHand: number; reorderLevel: number }[]).find(
      (r) => r.sku === LOW_SKU,
    );
    expect(ours).toBeDefined();
    expect(ours!.onHand).toBeLessThanOrEqual(ours!.reorderLevel);
  });

  it('stock-valuation report returns a non-negative total value', async () => {
    const res = await request(app).get('/api/v1/reports/stock-valuation').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalValue).toBeGreaterThanOrEqual(0);
    expect((res.body.data.rows as { brandName: string }[]).some((r) => r.brandName === 'MRF')).toBe(
      true,
    );
  });

  it('tax report aggregates tax for the 18% bracket', async () => {
    const res = await request(app).get('/api/v1/reports/tax').set(auth());
    expect(res.status).toBe(200);
    const row = (res.body.data.rows as { taxRatePct: number; taxAmount: number }[]).find(
      (r) => r.taxRatePct === TAX_PCT,
    );
    expect(row).toBeDefined();
    expect(row!.taxAmount).toBeGreaterThanOrEqual(EXPECTED_TAX);
    expect(res.body.data.summary.totalTax).toBeGreaterThanOrEqual(EXPECTED_TAX);
  });

  it('rejects an unknown report name with 400', async () => {
    const res = await request(app).get('/api/v1/reports/nonsense').set(auth());
    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/reports/sales');
    expect(res.status).toBe(401);
  });
});

// ─── Export ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/reports/:name/export', () => {
  it('exports CSV with the correct headers and a row for our sale', async () => {
    const res = await request(app).get('/api/v1/reports/sales/export?format=csv').set(auth());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('sales-');

    const lines = res.text.split('\r\n');
    expect(lines[0]).toBe(
      'Invoice No,Date,Customer,Items,Subtotal,Discount,Tax,Grand Total,Payment',
    );
    expect(lines.length).toBeGreaterThanOrEqual(2);
    // Some data row carries our grand total.
    expect(res.text).toContain(String(EXPECTED_GRAND));
  });

  it('defaults to CSV when no format is given', async () => {
    const res = await request(app).get('/api/v1/reports/low-stock/export').set(auth());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.split('\r\n')[0]).toBe('SKU,Product,Brand,On Hand,Reorder Level,Rack');
  });

  it('exports a valid PDF document', async () => {
    const res = await request(app)
      .get('/api/v1/reports/sales/export?format=pdf')
      .set(auth())
      .buffer()
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('.pdf');
    const body = res.body as Buffer;
    expect(body.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('rejects an invalid export format with 400', async () => {
    const res = await request(app)
      .get('/api/v1/reports/sales/export?format=xlsx')
      .set(auth());
    expect(res.status).toBe(400);
  });
});
