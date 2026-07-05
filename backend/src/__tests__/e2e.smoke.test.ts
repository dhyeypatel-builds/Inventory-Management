/**
 * I-02 end-to-end smoke flow.
 *
 * Exercises the full happy path against the real test database in one scripted
 * run: login → create a product with opening stock → sell it (stock deducts,
 * invoice issued) → a low-stock alert is raised → the sales report reflects the
 * sale. This is the cross-module integration guard for the MVP.
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

const TEST_EMAIL = 'smoke-test-user@tyrestock.test';
const TEST_PASSWORD = 'SmokePass@99';
const SMOKE_SKU = 'TYR-SMOKE-E2E';

// Opening stock 6, reorder level 5: selling 2 leaves 4 (≤ reorder) → LOW_STOCK.
const OPENING_STOCK = 6;
const REORDER_LEVEL = 5;
const SELL_QTY = 2;
const UNIT_PRICE = 2500;
const TAX_PCT = 18;

const EXPECTED_SUBTOTAL = SELL_QTY * UNIT_PRICE; // 5000
const EXPECTED_TAX = (EXPECTED_SUBTOTAL * TAX_PCT) / 100; // 900
const EXPECTED_GRAND = EXPECTED_SUBTOTAL + EXPECTED_TAX; // 5900

let accessToken: string;
let testUserId: string;

let productId: string;
let variantId: string;
let saleId: string;
let invoiceNo: string;

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, failedLogins: 0, isActive: true },
    create: { email: TEST_EMAIL, fullName: 'Smoke Test User', passwordHash, roleId: adminRole.id },
  });
  testUserId = user.id;
});

afterAll(async () => {
  await prisma.saleItem.deleteMany({ where: { saleId } });
  if (saleId) await prisma.sale.delete({ where: { id: saleId } }).catch(() => null);

  if (variantId) {
    await prisma.alert.deleteMany({ where: { variantId } });
    await prisma.stockMovement.deleteMany({ where: { variantId } });
  }
  if (productId) await prisma.product.delete({ where: { id: productId } }).catch(() => null);
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);
  await prisma.$disconnect();
});

describe('I-02 end-to-end smoke flow', () => {
  it('1. authenticates the admin user and returns a token + permissions', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    accessToken = res.body.data.accessToken as string;
    expect(accessToken).toBeTruthy();
    expect(Array.isArray(res.body.data.user.permissions)).toBe(true);
    expect(res.body.data.user.permissions.length).toBeGreaterThan(0);
  });

  it('2. creates a product with a variant and opening stock', async () => {
    const carTyre = await prisma.productType.findUniqueOrThrow({ where: { name: 'Tyre' } });
    const mrf = await prisma.brand.findFirstOrThrow({ where: { name: 'MRF', deletedAt: null } });

    const res = await request(app)
      .post('/api/v1/products')
      .set(auth())
      .send({
        productTypeId: carTyre.id,
        brandId: mrf.id,
        name: 'Smoke Test Tyre',
        variant: {
          sku: SMOKE_SKU,
          purchasePrice: 1500,
          sellingPrice: UNIT_PRICE,
          taxRatePct: TAX_PCT,
          attributes: { size: '195/65 R15', tyre_type: 'Tubeless' },
          openingStock: OPENING_STOCK,
          reorderLevel: REORDER_LEVEL,
        },
      });

    expect(res.status).toBe(201);
    productId = res.body.data.id;
    variantId = res.body.data.variants[0].id;

    // Opening stock landed in inventory and produced an OPENING movement.
    const inv = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });
    expect(inv.quantity).toBe(OPENING_STOCK);
    const opening = await prisma.stockMovement.findFirst({
      where: { variantId, type: 'OPENING' },
    });
    expect(opening).not.toBeNull();
  });

  it('3. sells the product: stock is deducted and an invoice is issued', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set(auth())
      .send({ paymentMode: 'CASH', items: [{ variantId, quantity: SELL_QTY }] });

    expect(res.status).toBe(201);
    saleId = res.body.data.id;
    invoiceNo = res.body.data.invoiceNo;

    expect(invoiceNo).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(res.body.data.subtotal).toBe(EXPECTED_SUBTOTAL);
    expect(res.body.data.taxTotal).toBe(EXPECTED_TAX);
    expect(res.body.data.grandTotal).toBe(EXPECTED_GRAND);

    // Stock deducted and a SALE movement recorded.
    const inv = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });
    expect(inv.quantity).toBe(OPENING_STOCK - SELL_QTY);
    const movement = await prisma.stockMovement.findFirst({
      where: { variantId, type: 'SALE', referenceId: saleId },
    });
    expect(movement).not.toBeNull();
    expect(movement!.quantityDelta).toBe(-SELL_QTY);
  });

  it('4. raises a LOW_STOCK alert now that on-hand is at/below the reorder level', async () => {
    const res = await request(app).get('/api/v1/alerts?status=OPEN').set(auth());
    expect(res.status).toBe(200);

    const ours = (res.body.data as { variantId: string; type: string; status: string }[]).find(
      (a) => a.variantId === variantId,
    );
    expect(ours).toBeDefined();
    expect(ours!.type).toBe('LOW_STOCK');
    expect(ours!.status).toBe('OPEN');
  });

  it('5. reflects the sale in the sales report', async () => {
    const res = await request(app).get('/api/v1/reports/sales').set(auth());
    expect(res.status).toBe(200);

    expect(res.body.data.summary.salesCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.summary.grandTotal).toBeGreaterThanOrEqual(EXPECTED_GRAND);

    const ours = (res.body.data.rows as { invoiceNo: string; grandTotal: number }[]).find(
      (r) => r.invoiceNo === invoiceNo,
    );
    expect(ours).toBeDefined();
    expect(ours!.grandTotal).toBe(EXPECTED_GRAND);
  });
});
