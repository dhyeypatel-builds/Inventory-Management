/**
 * C-03 / C-04 integration tests for /products and /variants.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.dev.yml up -d
 *   npx prisma migrate deploy
 *   npx prisma db seed   ← creates ADMIN role, Tyre product type, 6 brands
 */

import request from 'supertest';
import { app } from '../app';
import { prisma } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';

// ─── Test user ────────────────────────────────────────────────────────────────

const TEST_EMAIL = 'products-test-user@tyrestock.test';
const TEST_PASSWORD = 'ProductsPass@99';

let accessToken: string;
let testUserId: string;

// IDs resolved from seed data
let productTypeId: number;
let brandId: number;
let categoryId: number;

// Products created during tests (cleaned up in afterAll)
const createdProductIds: string[] = [];

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, failedLogins: 0, isActive: true },
    create: {
      email: TEST_EMAIL,
      fullName: 'Products Test User',
      passwordHash,
      roleId: adminRole.id,
    },
  });
  testUserId = user.id;

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  accessToken = loginRes.body.data.accessToken as string;

  // Resolve seeded reference data
  const carTyre = await prisma.productType.findUniqueOrThrow({ where: { name: 'Tyre' } });
  productTypeId = carTyre.id;

  const mrf = await prisma.brand.findFirstOrThrow({ where: { name: 'MRF', deletedAt: null } });
  brandId = mrf.id;

  const car = await prisma.category.findFirstOrThrow({ where: { slug: 'car' } });
  categoryId = car.id;
});

afterAll(async () => {
  // Clean up: delete stock movements first (no cascade from variant), then products
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

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

// SRS §5.3 worked example payload
const SRS_PRODUCT = {
  productTypeId: 0, // set in beforeAll
  brandId: 0,
  categoryId: 0,
  name: 'MRF ZLX',
  warrantyMonths: 60,
  variant: {
    sku: 'TYR-MRF-19565R15-T',
    purchasePrice: 4000,
    sellingPrice: 4800,
    taxRatePct: 18,
    manufacturingDate: '2026-01-01',
    attributes: {
      size: '195/65 R15',
      tyre_type: 'Tubeless',
      position: 'Universal',
    },
    openingStock: 20,
    rackLocation: 'Rack A-12',
    reorderLevel: 5,
  },
};

// ─── POST /products ───────────────────────────────────────────────────────────

describe('POST /api/v1/products', () => {
  it('creates a product matching the SRS §5.3 worked example', async () => {
    const payload = {
      ...SRS_PRODUCT,
      productTypeId,
      brandId,
      categoryId,
    };

    const res = await request(app).post('/api/v1/products').set(auth()).send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const p = res.body.data;
    createdProductIds.push(p.id);

    expect(p.name).toBe('MRF ZLX');
    expect(p.warrantyMonths).toBe(60);
    expect(p.brand.name).toBe('MRF');
    expect(p.productType.name).toBe('Tyre');

    // Variant present with resolved attribute values
    expect(p.variants).toHaveLength(1);
    const v = p.variants[0];
    expect(v.sku).toBe('TYR-MRF-19565R15-T');
    expect(Number(v.sellingPrice)).toBe(4800);
    expect(v.attributeValues.size).toBe('195/65 R15');
    expect(v.attributeValues.tyre_type).toBe('Tubeless');
    expect(v.attributeValues.position).toBe('Universal');

    // Opening inventory
    expect(v.inventory.quantity).toBe(20);
    expect(v.inventory.rackLocation).toBe('Rack A-12');
    expect(v.inventory.reorderLevel).toBe(5);
  });

  it('creates an opening OPENING stock movement', async () => {
    const payload = {
      ...SRS_PRODUCT,
      productTypeId,
      brandId,
      categoryId,
      name: 'MRF ZLX Movement Check',
      variant: { ...SRS_PRODUCT.variant, sku: 'TYR-MRF-MVMT-T', openingStock: 10 },
    };

    const res = await request(app).post('/api/v1/products').set(auth()).send(payload);
    expect(res.status).toBe(201);
    const variantId = res.body.data.variants[0].id;
    createdProductIds.push(res.body.data.id);

    const movement = await prisma.stockMovement.findFirst({ where: { variantId, type: 'OPENING' } });
    expect(movement).not.toBeNull();
    expect(movement!.quantityDelta).toBe(10);
    expect(movement!.balanceAfter).toBe(10);
  });

  it('returns 400 when a required attribute is missing', async () => {
    const payload = {
      productTypeId,
      brandId,
      name: 'Missing Required Attr',
      variant: {
        sku: 'TYR-MISS-ATTR-T',
        purchasePrice: 1000,
        sellingPrice: 1200,
        attributes: {
          // size and tyre_type are required — omitting them
          position: 'Universal',
        },
        openingStock: 0,
      },
    };

    const res = await request(app).post('/api/v1/products').set(auth()).send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body.error.details)).toContain('size');
  });

  it('returns 400 when an ENUM attribute has an invalid value', async () => {
    const payload = {
      productTypeId,
      brandId,
      name: 'Bad ENUM',
      variant: {
        sku: 'TYR-BAD-ENUM-T',
        purchasePrice: 1000,
        sellingPrice: 1200,
        attributes: {
          size: 'INVALID-SIZE',        // not in the allowed options
          tyre_type: 'Tubeless',
        },
        openingStock: 0,
      },
    };

    const res = await request(app).post('/api/v1/products').set(auth()).send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    // Error names the bad value; the attribute label is "Tyre Size"
    expect(JSON.stringify(res.body.error.details)).toContain('INVALID-SIZE');
  });

  it('returns 409 for a duplicate SKU', async () => {
    const payload = {
      productTypeId,
      name: 'Dupe SKU Product',
      variant: {
        sku: 'TYR-MRF-19565R15-T', // already created in first test
        purchasePrice: 1000,
        sellingPrice: 1200,
        attributes: { size: '195/65 R15', tyre_type: 'Tubeless' },
        openingStock: 0,
      },
    };

    const res = await request(app).post('/api/v1/products').set(auth()).send(payload);
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid SKU format', async () => {
    const payload = {
      productTypeId,
      name: 'Bad SKU',
      variant: {
        sku: 'bad-sku-lowercase',
        purchasePrice: 1000,
        sellingPrice: 1200,
        attributes: {},
        openingStock: 0,
      },
    };

    const res = await request(app).post('/api/v1/products').set(auth()).send(payload);
    expect(res.status).toBe(400);
  });

  it('creates a product without a variant', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(auth())
      .send({ productTypeId, name: 'No Variant Product' });

    expect(res.status).toBe(201);
    expect(res.body.data.variants).toHaveLength(0);
    createdProductIds.push(res.body.data.id);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/products').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

// ─── GET /products ────────────────────────────────────────────────────────────

describe('GET /api/v1/products', () => {
  it('returns paginated product list', async () => {
    const res = await request(app).get('/api/v1/products').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 20 });
  });

  it('filters by q (name search)', async () => {
    const res = await request(app).get('/api/v1/products?q=MRF+ZLX').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    res.body.data.forEach((p: { name: string }) =>
      expect(p.name.toLowerCase()).toContain('mrf zlx'),
    );
  });

  it('filters by brand', async () => {
    const res = await request(app).get(`/api/v1/products?brand=${brandId}`).set(auth());
    expect(res.status).toBe(200);
    res.body.data.forEach((p: { brand: { id: number } }) =>
      expect(p.brand.id).toBe(brandId),
    );
  });

  it('filters by product type', async () => {
    const res = await request(app).get(`/api/v1/products?type=${productTypeId}`).set(auth());
    expect(res.status).toBe(200);
    res.body.data.forEach((p: { productType: { id: number } }) =>
      expect(p.productType.id).toBe(productTypeId),
    );
  });
});

// ─── GET /products/:id ────────────────────────────────────────────────────────

describe('GET /api/v1/products/:id', () => {
  it('returns product with resolved attribute values', async () => {
    // Find the SRS product created earlier
    const product = await prisma.product.findFirstOrThrow({
      where: { name: 'MRF ZLX', deletedAt: null },
    });

    const res = await request(app).get(`/api/v1/products/${product.id}`).set(auth());
    expect(res.status).toBe(200);

    const p = res.body.data;
    expect(p.id).toBe(product.id);
    expect(p.variants).toHaveLength(1);

    const v = p.variants[0];
    expect(typeof v.attributeValues).toBe('object');
    expect(v.attributeValues.size).toBe('195/65 R15');
    expect(v.attributeValues.tyre_type).toBe('Tubeless');
    expect(v.inventory).toBeDefined();
    expect(v.inventory.quantity).toBe(20);
  });

  it('returns 404 for non-existent product', async () => {
    const res = await request(app)
      .get('/api/v1/products/00000000-0000-0000-0000-000000000000')
      .set(auth());
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /products/:id ──────────────────────────────────────────────────────

describe('PATCH /api/v1/products/:id', () => {
  it('updates product name', async () => {
    const product = await prisma.product.findFirstOrThrow({
      where: { name: 'MRF ZLX', deletedAt: null },
    });

    const res = await request(app)
      .patch(`/api/v1/products/${product.id}`)
      .set(auth())
      .send({ name: 'MRF ZLX Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('MRF ZLX Updated');

    // Restore name for other tests
    await prisma.product.update({ where: { id: product.id }, data: { name: 'MRF ZLX' } });
  });
});

// ─── DELETE /products/:id (soft-delete) ───────────────────────────────────────

describe('DELETE /api/v1/products/:id', () => {
  it('soft-deletes a product and excludes it from list', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(auth())
      .send({ productTypeId, name: 'To Be Deleted' });
    const productId = res.body.data.id;
    createdProductIds.push(productId);

    const del = await request(app).delete(`/api/v1/products/${productId}`).set(auth());
    expect(del.status).toBe(204);

    const get = await request(app).get(`/api/v1/products/${productId}`).set(auth());
    expect(get.status).toBe(404);
  });
});

// ─── POST /products/:id/variants ─────────────────────────────────────────────

describe('POST /api/v1/products/:id/variants', () => {
  it('adds a second variant to an existing product', async () => {
    const product = await prisma.product.findFirstOrThrow({
      where: { name: 'MRF ZLX', deletedAt: null },
    });

    const res = await request(app)
      .post(`/api/v1/products/${product.id}/variants`)
      .set(auth())
      .send({
        sku: 'TYR-MRF-20555R16-T',
        purchasePrice: 5000,
        sellingPrice: 6000,
        taxRatePct: 18,
        attributes: { size: '205/55 R16', tyre_type: 'Tubeless' },
        openingStock: 5,
        reorderLevel: 3,
      });

    expect(res.status).toBe(201);
    const v = res.body.data;
    expect(v.sku).toBe('TYR-MRF-20555R16-T');
    expect(v.attributeValues.size).toBe('205/55 R16');
    expect(v.inventory.quantity).toBe(5);
  });
});

// ─── GET /variants (C-04 search) ──────────────────────────────────────────────

describe('GET /api/v1/variants', () => {
  it('returns paginated variant list', async () => {
    const res = await request(app).get('/api/v1/variants').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1 });
  });

  it('searches by partial product name (q)', async () => {
    const res = await request(app).get('/api/v1/variants?q=MRF').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    res.body.data.forEach((v: { productName: string }) =>
      expect(v.productName.toLowerCase()).toContain('mrf'),
    );
  });

  it('filters by size attribute', async () => {
    const res = await request(app)
      .get('/api/v1/variants?size=195%2F65+R15')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    res.body.data.forEach((v: { attributeValues: Record<string, unknown> }) =>
      expect(v.attributeValues.size).toBe('195/65 R15'),
    );
  });

  it('inStock=true excludes zero-quantity variants', async () => {
    // Create a product with 0 opening stock
    const zeroRes = await request(app)
      .post('/api/v1/products')
      .set(auth())
      .send({
        productTypeId,
        name: 'Zero Stock Product',
        variant: {
          sku: 'TYR-ZERO-STOCK-T',
          purchasePrice: 1000,
          sellingPrice: 1200,
          attributes: { size: '145/80 R12', tyre_type: 'Tubeless' },
          openingStock: 0,
          reorderLevel: 2,
        },
      });
    expect(zeroRes.status).toBe(201);
    const zeroVariantId = zeroRes.body.data.variants[0].id;
    createdProductIds.push(zeroRes.body.data.id);

    // With inStock=true, zero-stock variant should NOT appear
    const inStockRes = await request(app).get('/api/v1/variants?inStock=true').set(auth());
    expect(inStockRes.status).toBe(200);
    const ids = (inStockRes.body.data as { id: string }[]).map((v) => v.id);
    expect(ids).not.toContain(zeroVariantId);

    // Without inStock filter, it should appear
    const allRes = await request(app).get('/api/v1/variants?q=Zero+Stock').set(auth());
    expect(allRes.status).toBe(200);
    const allIds = (allRes.body.data as { id: string }[]).map((v) => v.id);
    expect(allIds).toContain(zeroVariantId);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/variants');
    expect(res.status).toBe(401);
  });

  it('response shape includes expected fields', async () => {
    const res = await request(app).get('/api/v1/variants?q=MRF').set(auth());
    expect(res.status).toBe(200);
    const v = res.body.data[0];
    expect(v).toHaveProperty('id');
    expect(v).toHaveProperty('sku');
    expect(v).toHaveProperty('productName');
    expect(v).toHaveProperty('sellingPrice');
    expect(v).toHaveProperty('onHand');
    expect(v).toHaveProperty('attributeValues');
  });
});
