/**
 * D-01 / D-02 integration tests for /inventory.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.dev.yml up -d
 *   npx prisma migrate deploy
 *   npx prisma db seed   ← creates ADMIN role, Car Tyre product type, 6 brands
 */

import request from 'supertest';
import { app } from '../app';
import { prisma } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';

// ─── Test user ────────────────────────────────────────────────────────────────

const TEST_EMAIL = 'inventory-test-user@tyrestock.test';
const TEST_PASSWORD = 'InventoryPass@99';

let accessToken: string;
let testUserId: string;

let productTypeId: number;
let brandId: number;

// Variants created for these tests
let stockedVariantId: string; // opening stock 30, reorder 5
let lowVariantId: string; // opening stock 3, reorder 5 (low)

const createdProductIds: string[] = [];

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

async function createProductWithVariant(opts: {
  name: string;
  sku: string;
  size: string;
  openingStock: number;
  reorderLevel: number;
  rackLocation?: string;
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
        rackLocation: opts.rackLocation,
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
      fullName: 'Inventory Test User',
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

  stockedVariantId = await createProductWithVariant({
    name: 'Inv Stocked Tyre',
    sku: 'TYR-INV-STOCKED',
    size: '195/65 R15',
    openingStock: 30,
    reorderLevel: 5,
    rackLocation: 'Rack INV-1',
  });

  lowVariantId = await createProductWithVariant({
    name: 'Inv Low Tyre',
    sku: 'TYR-INV-LOW',
    size: '205/55 R16',
    openingStock: 3,
    reorderLevel: 5,
    rackLocation: 'Rack INV-2',
  });
});

afterAll(async () => {
  for (const productId of createdProductIds) {
    const variants = await prisma.productVariant.findMany({ where: { productId } });
    const variantIds = variants.map((v) => v.id);
    if (variantIds.length > 0) {
      await prisma.stockMovement.deleteMany({ where: { variantId: { in: variantIds } } });
    }
    await prisma.product.delete({ where: { id: productId } }).catch(() => null);
  }
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);
  await prisma.$disconnect();
});

// ─── GET /inventory ────────────────────────────────────────────────────────────

describe('GET /api/v1/inventory', () => {
  it('returns paginated inventory list with on-hand vs threshold', async () => {
    const res = await request(app).get('/api/v1/inventory?q=Inv+Stocked').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1 });

    const row = (res.body.data as { variantId: string }[]).find(
      (r) => r.variantId === stockedVariantId,
    );
    expect(row).toBeDefined();
    expect(row).toMatchObject({
      onHand: 30,
      reorderLevel: 5,
      lowStock: false,
      rackLocation: 'Rack INV-1',
    });
  });

  it('lowStock=true returns only variants at/below threshold', async () => {
    const res = await request(app).get('/api/v1/inventory?lowStock=true').set(auth());
    expect(res.status).toBe(200);
    const ids = (res.body.data as { variantId: string; lowStock: boolean }[]).map(
      (r) => r.variantId,
    );
    expect(ids).toContain(lowVariantId);
    expect(ids).not.toContain(stockedVariantId);
    (res.body.data as { lowStock: boolean }[]).forEach((r) => expect(r.lowStock).toBe(true));
  });

  it('filters by rack location', async () => {
    const res = await request(app).get('/api/v1/inventory?rack=INV-2').set(auth());
    expect(res.status).toBe(200);
    const ids = (res.body.data as { variantId: string }[]).map((r) => r.variantId);
    expect(ids).toContain(lowVariantId);
    expect(ids).not.toContain(stockedVariantId);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/inventory');
    expect(res.status).toBe(401);
  });
});

// ─── GET /inventory/:variantId ──────────────────────────────────────────────────

describe('GET /api/v1/inventory/:variantId', () => {
  it('returns inventory detail for a variant', async () => {
    const res = await request(app).get(`/api/v1/inventory/${stockedVariantId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      variantId: stockedVariantId,
      onHand: 30,
      reorderLevel: 5,
      lowStock: false,
    });
    expect(res.body.data.attributeValues.size).toBe('195/65 R15');
  });

  it('returns 404 for an unknown variant', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/00000000-0000-0000-0000-000000000000')
      .set(auth());
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /inventory/:variantId ────────────────────────────────────────────────

describe('PATCH /api/v1/inventory/:variantId', () => {
  it('updates reorderLevel and rackLocation', async () => {
    const res = await request(app)
      .patch(`/api/v1/inventory/${stockedVariantId}`)
      .set(auth())
      .send({ reorderLevel: 8, rackLocation: 'Rack INV-1B' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ reorderLevel: 8, rackLocation: 'Rack INV-1B' });

    // Persisted
    const inv = await prisma.inventory.findUniqueOrThrow({ where: { variantId: stockedVariantId } });
    expect(inv.reorderLevel).toBe(8);
    expect(inv.rackLocation).toBe('Rack INV-1B');
  });

  it('rejects an empty patch body', async () => {
    const res = await request(app)
      .patch(`/api/v1/inventory/${stockedVariantId}`)
      .set(auth())
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── POST /inventory/:variantId/adjust (D-02) ───────────────────────────────────

describe('POST /api/v1/inventory/:variantId/adjust', () => {
  it('applies a positive adjustment and updates on-hand', async () => {
    const before = await prisma.inventory.findUniqueOrThrow({
      where: { variantId: stockedVariantId },
    });

    const res = await request(app)
      .post(`/api/v1/inventory/${stockedVariantId}/adjust`)
      .set(auth())
      .send({ delta: 10, reason: 'Stock count correction' });

    expect(res.status).toBe(200);
    expect(res.body.data.onHand).toBe(before.quantity + 10);

    const movement = await prisma.stockMovement.findFirst({
      where: { variantId: stockedVariantId, type: 'ADJUSTMENT' },
      orderBy: { createdAt: 'desc' },
    });
    expect(movement).not.toBeNull();
    expect(movement!.quantityDelta).toBe(10);
    expect(movement!.balanceAfter).toBe(before.quantity + 10);
    expect(movement!.createdBy).toBe(testUserId);
  });

  it('applies a negative adjustment', async () => {
    const before = await prisma.inventory.findUniqueOrThrow({
      where: { variantId: stockedVariantId },
    });

    const res = await request(app)
      .post(`/api/v1/inventory/${stockedVariantId}/adjust`)
      .set(auth())
      .send({ delta: -5, reason: 'Damaged units', note: 'Water damage' });

    expect(res.status).toBe(200);
    expect(res.body.data.onHand).toBe(before.quantity - 5);
  });

  it('rejects an adjustment that would go negative with 409', async () => {
    const inv = await prisma.inventory.findUniqueOrThrow({
      where: { variantId: lowVariantId },
    });

    const res = await request(app)
      .post(`/api/v1/inventory/${lowVariantId}/adjust`)
      .set(auth())
      .send({ delta: -(inv.quantity + 1), reason: 'Oversell attempt' });

    expect(res.status).toBe(409);

    // Quantity unchanged
    const after = await prisma.inventory.findUniqueOrThrow({ where: { variantId: lowVariantId } });
    expect(after.quantity).toBe(inv.quantity);
  });

  it('rejects a zero delta with 400', async () => {
    const res = await request(app)
      .post(`/api/v1/inventory/${stockedVariantId}/adjust`)
      .set(auth())
      .send({ delta: 0, reason: 'noop' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing reason with 400', async () => {
    const res = await request(app)
      .post(`/api/v1/inventory/${stockedVariantId}/adjust`)
      .set(auth())
      .send({ delta: 1 });
    expect(res.status).toBe(400);
  });
});

// ─── GET /inventory/:variantId/movements (D-02) ─────────────────────────────────

describe('GET /api/v1/inventory/:variantId/movements', () => {
  it('returns the movement ledger ordered by date with running balanceAfter', async () => {
    const res = await request(app)
      .get(`/api/v1/inventory/${stockedVariantId}/movements`)
      .set(auth());

    expect(res.status).toBe(200);
    const items = res.body.data as {
      type: string;
      quantityDelta: number;
      balanceAfter: number;
      createdAt: string;
    }[];

    // OPENING + at least the two adjustments above
    expect(items.length).toBeGreaterThanOrEqual(3);

    // Default order is newest-first
    for (let i = 1; i < items.length; i++) {
      expect(new Date(items[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(items[i].createdAt).getTime(),
      );
    }

    // balanceAfter matches the running sum of deltas (oldest → newest)
    const chrono = [...items].reverse();
    let running = 0;
    for (const m of chrono) {
      running += m.quantityDelta;
      expect(m.balanceAfter).toBe(running);
    }
  });

  it('returns 404 for an unknown variant', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/00000000-0000-0000-0000-000000000000/movements')
      .set(auth());
    expect(res.status).toBe(404);
  });
});

// ─── GET /inventory/valuation (D-03) ────────────────────────────────────────

describe('GET /api/v1/inventory/valuation', () => {
  it('returns totalValue, byBrand, and byCategory', async () => {
    const res = await request(app).get('/api/v1/inventory/valuation').set(auth());

    expect(res.status).toBe(200);
    const data = res.body.data as {
      totalValue: number;
      byBrand: { brandId: number | null; brandName: string; totalQty: number; totalValue: number }[];
      byCategory: { categoryId: number | null; categoryName: string; totalQty: number; totalValue: number }[];
    };

    expect(typeof data.totalValue).toBe('number');
    expect(data.totalValue).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(data.byBrand)).toBe(true);
    expect(Array.isArray(data.byCategory)).toBe(true);
  });

  it('sum of brand totals equals grand total', async () => {
    const res = await request(app).get('/api/v1/inventory/valuation').set(auth());
    expect(res.status).toBe(200);

    const { totalValue, byBrand } = res.body.data as {
      totalValue: number;
      byBrand: { totalValue: number }[];
    };

    const brandSum = byBrand.reduce((acc, b) => acc + b.totalValue, 0);
    expect(brandSum).toBeCloseTo(totalValue, 2);
  });

  it('computed totals match qty × purchasePrice for our test variants', async () => {
    // Both test variants have purchasePrice = 1000.
    // After all prior tests: stocked = 30 + 10 − 5 = 35, low = 3.
    // Read actual DB quantities to avoid coupling to order-of-tests.
    const stockedInv = await prisma.inventory.findUniqueOrThrow({ where: { variantId: stockedVariantId } });
    const lowInv = await prisma.inventory.findUniqueOrThrow({ where: { variantId: lowVariantId } });
    const expectedContribution = (stockedInv.quantity + lowInv.quantity) * 1000;

    const res = await request(app).get('/api/v1/inventory/valuation').set(auth());
    expect(res.status).toBe(200);

    const { totalValue } = res.body.data as { totalValue: number };
    expect(totalValue).toBeGreaterThanOrEqual(expectedContribution);
  });

  it('each brand/category row has required fields and non-negative values', async () => {
    const res = await request(app).get('/api/v1/inventory/valuation').set(auth());
    expect(res.status).toBe(200);

    const { byBrand, byCategory } = res.body.data as {
      byBrand: { brandName: string; totalQty: number; totalValue: number }[];
      byCategory: { categoryName: string; totalQty: number; totalValue: number }[];
    };

    for (const row of byBrand) {
      expect(typeof row.brandName).toBe('string');
      expect(row.totalQty).toBeGreaterThanOrEqual(0);
      expect(row.totalValue).toBeGreaterThanOrEqual(0);
    }
    for (const row of byCategory) {
      expect(typeof row.categoryName).toBe('string');
      expect(row.totalQty).toBeGreaterThanOrEqual(0);
      expect(row.totalValue).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/inventory/valuation');
    expect(res.status).toBe(401);
  });
});
