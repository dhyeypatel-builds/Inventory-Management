/**
 * Integration tests for /purchases, /vendors and /serials.
 *
 * Prerequisites:
 *   docker compose up -d postgres
 *   npx prisma migrate deploy && npx prisma db seed
 */

import request from 'supertest';
import { app } from '../app';
import { prisma } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';

const TEST_EMAIL = 'purchases-test-user@tyrestock.test';
const TEST_PASSWORD = 'PurchasePass@99';

let accessToken: string;
let testUserId: string;
let productTypeId: number;
let brandId: number;
let variantId: string;
let productId: string;

const createdPurchaseIds: string[] = [];
const createdVendorIds: string[] = [];
const createdSaleIds: string[] = [];

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, failedLogins: 0, isActive: true },
    create: {
      email: TEST_EMAIL,
      fullName: 'Purchases Test User',
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
  const brand = await prisma.brand.findFirstOrThrow({ where: { deletedAt: null } });
  brandId = brand.id;

  const res = await request(app)
    .post('/api/v1/products')
    .set(auth())
    .send({
      productTypeId,
      brandId,
      name: 'Purchases Test Tyre',
      variant: {
        sku: 'TYR-PURCH-MAIN',
        purchasePrice: 1000,
        sellingPrice: 2000,
        taxRatePct: 20,
        attributes: { size: '195/65 R15', tyre_type: 'Tubeless' },
        openingStock: 10,
        reorderLevel: 5,
      },
    });
  expect(res.status).toBe(201);
  productId = res.body.data.id as string;
  variantId = res.body.data.variants[0].id as string;
});

afterAll(async () => {
  await prisma.serialNumber.deleteMany({ where: { variantId } });
  await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: createdPurchaseIds } } });
  await prisma.purchase.deleteMany({ where: { id: { in: createdPurchaseIds } } });
  await prisma.vendor.deleteMany({
    where: { OR: [{ id: { in: createdVendorIds } }, { name: { startsWith: 'PurchTest' } }] },
  });
  await prisma.saleItem.deleteMany({ where: { saleId: { in: createdSaleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: createdSaleIds } } });
  await prisma.alert.deleteMany({ where: { variantId } });
  await prisma.stockMovement.deleteMany({ where: { variantId } });
  await prisma.product.delete({ where: { id: productId } }).catch(() => null);
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);
  await prisma.$disconnect();
});

// ─── Vendors ─────────────────────────────────────────────────────────────────

describe('POST /api/v1/vendors', () => {
  it('creates a vendor', async () => {
    const res = await request(app)
      .post('/api/v1/vendors')
      .set(auth())
      .send({ name: 'PurchTest Tyres Ltd', phone: '+441234567890' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('PurchTest Tyres Ltd');
    createdVendorIds.push(res.body.data.id);
  });

  it('lists vendors with search', async () => {
    const res = await request(app).get('/api/v1/vendors?q=PurchTest').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.some((v: { name: string }) => v.name === 'PurchTest Tyres Ltd')).toBe(
      true,
    );
  });
});

// ─── Purchases ───────────────────────────────────────────────────────────────

describe('POST /api/v1/purchases', () => {
  it('receives stock with serials, increments inventory, writes a PURCHASE movement', async () => {
    const before = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });

    const res = await request(app)
      .post('/api/v1/purchases')
      .set(auth())
      .send({
        vendorName: 'PurchTest AutoParts', // auto-created
        invoiceNo: 'VND-2026-001',
        invoiceDate: '2026-06-01',
        items: [
          {
            variantId,
            quantity: 4,
            unitCost: 950,
            taxRatePct: 20,
            serials: ['SER-A-001', 'SER-A-002', 'SER-A-003', 'SER-A-004'],
          },
        ],
      });

    expect(res.status).toBe(201);
    createdPurchaseIds.push(res.body.data.id);

    // Totals: base 3800, tax 760, grand 4560
    expect(res.body.data.subtotal).toBe(3800);
    expect(res.body.data.taxTotal).toBe(760);
    expect(res.body.data.grandTotal).toBe(4560);
    expect(res.body.data.vendor.name).toBe('PurchTest AutoParts');
    expect(res.body.data.items[0].serials).toHaveLength(4);

    // Stock incremented
    const after = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });
    expect(after.quantity).toBe(before.quantity + 4);

    // PURCHASE ledger entry
    const movement = await prisma.stockMovement.findFirst({
      where: { variantId, type: 'PURCHASE', referenceId: res.body.data.id },
    });
    expect(movement).not.toBeNull();
    expect(movement!.quantityDelta).toBe(4);
  });

  it('rejects a duplicate serial number with 409', async () => {
    const res = await request(app)
      .post('/api/v1/purchases')
      .set(auth())
      .send({
        vendorName: 'PurchTest AutoParts',
        invoiceNo: 'VND-2026-002',
        invoiceDate: '2026-06-02',
        items: [{ variantId, quantity: 1, unitCost: 950, serials: ['SER-A-001'] }],
      });
    expect(res.status).toBe(409);
  });

  it('rejects more serials than quantity with 400', async () => {
    const res = await request(app)
      .post('/api/v1/purchases')
      .set(auth())
      .send({
        vendorName: 'PurchTest AutoParts',
        invoiceNo: 'VND-2026-003',
        invoiceDate: '2026-06-02',
        items: [{ variantId, quantity: 1, unitCost: 950, serials: ['SER-X-1', 'SER-X-2'] }],
      });
    expect(res.status).toBe(400);
  });

  it('lists purchases with vendor name and item count', async () => {
    const res = await request(app).get('/api/v1/purchases').set(auth());
    expect(res.status).toBe(200);
    const row = res.body.data.find((p: { invoiceNo: string }) => p.invoiceNo === 'VND-2026-001');
    expect(row).toBeDefined();
    expect(row.vendorName).toBe('PurchTest AutoParts');
    expect(row.itemCount).toBe(1);
    expect(row.grandTotal).toBe(4560);
  });
});

// ─── Serial tracing through a sale ───────────────────────────────────────────

describe('Serial lifecycle', () => {
  let saleId: string;

  it('sells a serialised unit and the serial flips to SOLD with the sale linked', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set(auth())
      .send({
        paymentMode: 'CASH',
        items: [{ variantId, quantity: 1, discount: 0, serials: ['SER-A-002'] }],
      });
    expect(res.status).toBe(201);
    saleId = res.body.data.id;
    createdSaleIds.push(saleId);

    const lookup = await request(app).get('/api/v1/serials/SER-A-002').set(auth());
    expect(lookup.status).toBe(200);
    expect(lookup.body.data.status).toBe('SOLD');
    expect(lookup.body.data.sale.invoiceNo).toBe(res.body.data.invoiceNo);
    expect(lookup.body.data.purchase.invoiceNo).toBe('VND-2026-001');
    expect(lookup.body.data.variant.sku).toBe('TYR-PURCH-MAIN');
  });

  it('rejects selling a serial that is not in stock', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set(auth())
      .send({
        paymentMode: 'CASH',
        items: [{ variantId, quantity: 1, discount: 0, serials: ['SER-A-002'] }],
      });
    expect(res.status).toBe(400);
  });

  it('releases the serial back to IN_STOCK when the sale is cancelled', async () => {
    const res = await request(app).post(`/api/v1/sales/${saleId}/cancel`).set(auth());
    expect(res.status).toBe(200);

    const lookup = await request(app).get('/api/v1/serials/SER-A-002').set(auth());
    expect(lookup.body.data.status).toBe('IN_STOCK');
    expect(lookup.body.data.sale).toBeNull();
  });

  it('supports manual DOA marking via PATCH', async () => {
    const res = await request(app)
      .patch('/api/v1/serials/SER-A-003')
      .set(auth())
      .send({ status: 'DOA' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DOA');
  });

  it('404s for an unknown serial', async () => {
    const res = await request(app).get('/api/v1/serials/NO-SUCH-SERIAL').set(auth());
    expect(res.status).toBe(404);
  });
});
