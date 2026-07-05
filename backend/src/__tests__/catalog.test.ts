/**
 * C-01 / C-02 integration tests for brands, categories, and product-types.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.dev.yml up -d
 *   npx prisma migrate deploy
 *   npx prisma db seed        ← creates ADMIN role, 6 brands, 8 categories, Tyre type
 */

import request from 'supertest';
import { app } from '../app';
import { prisma } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';

// ─── Test user fixture ─────────────────────────────────────────────────────────

const TEST_EMAIL = 'catalog-test-user@tyrestock.test';
const TEST_PASSWORD = 'CatalogPass@99';

let accessToken: string;
let testUserId: string;

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });

  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, failedLogins: 0, isActive: true },
    create: { email: TEST_EMAIL, fullName: 'Catalog Test User', passwordHash, roleId: adminRole.id },
  });
  testUserId = user.id;

  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

  accessToken = res.body.data.accessToken as string;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: testUserId } });
  await prisma.$disconnect();
});

// ─── helpers ──────────────────────────────────────────────────────────────────

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

// ─── Brands ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/brands', () => {
  it('returns paginated list of active brands', async () => {
    const res = await request(app).get('/api/v1/brands').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 20 });
    // Seed has 6 brands
    expect(res.body.meta.total).toBeGreaterThanOrEqual(6);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/brands');
    expect(res.status).toBe(401);
  });

  it('filters by q', async () => {
    const res = await request(app).get('/api/v1/brands?q=mrf').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].name.toLowerCase()).toContain('mrf');
  });
});

describe('POST /api/v1/brands', () => {
  let createdId: number;

  afterEach(async () => {
    if (createdId) {
      await prisma.brand.delete({ where: { id: createdId } }).catch(() => null);
      createdId = 0;
    }
  });

  it('creates a brand and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/brands')
      .set(auth())
      .send({ name: 'TestBrand-C01' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('TestBrand-C01');
    createdId = res.body.data.id;
  });

  it('returns 409 for duplicate brand name', async () => {
    const first = await request(app)
      .post('/api/v1/brands')
      .set(auth())
      .send({ name: 'DupeBrand-C01' });
    createdId = first.body.data.id;

    const dup = await request(app)
      .post('/api/v1/brands')
      .set(auth())
      .send({ name: 'DupeBrand-C01' });

    expect(dup.status).toBe(409);
  });

  it('returns 400 for missing name', async () => {
    const res = await request(app).post('/api/v1/brands').set(auth()).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/brands/:id', () => {
  it('returns a brand by id', async () => {
    const brand = await prisma.brand.findFirstOrThrow({ where: { deletedAt: null } });
    const res = await request(app).get(`/api/v1/brands/${brand.id}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(brand.id);
  });

  it('returns 404 for non-existent brand', async () => {
    const res = await request(app).get('/api/v1/brands/999999').set(auth());
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/brands/:id', () => {
  let brandId: number;

  beforeEach(async () => {
    const brand = await prisma.brand.create({ data: { name: `PatchBrand-${Date.now()}` } });
    brandId = brand.id;
  });

  afterEach(async () => {
    await prisma.brand.delete({ where: { id: brandId } }).catch(() => null);
  });

  it('updates brand name', async () => {
    const res = await request(app)
      .patch(`/api/v1/brands/${brandId}`)
      .set(auth())
      .send({ name: 'UpdatedBrandName' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('UpdatedBrandName');
  });

  it('returns 404 for non-existent brand', async () => {
    const res = await request(app)
      .patch('/api/v1/brands/999999')
      .set(auth())
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/brands/:id (soft-delete)', () => {
  it('soft-deletes a brand and excludes it from list', async () => {
    const brand = await prisma.brand.create({ data: { name: `DeleteBrand-${Date.now()}` } });

    const del = await request(app).delete(`/api/v1/brands/${brand.id}`).set(auth());
    expect(del.status).toBe(204);

    // Should not appear in the default list
    const list = await request(app).get('/api/v1/brands').set(auth());
    const ids = (list.body.data as { id: number }[]).map((b) => b.id);
    expect(ids).not.toContain(brand.id);

    // GET by id should 404
    const get = await request(app).get(`/api/v1/brands/${brand.id}`).set(auth());
    expect(get.status).toBe(404);

    // Cleanup
    await prisma.brand.delete({ where: { id: brand.id } });
  });
});

// ─── Categories ───────────────────────────────────────────────────────────────

describe('GET /api/v1/categories', () => {
  it('returns all active categories with parent and children info', async () => {
    const res = await request(app).get('/api/v1/categories').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(8);
    // Each item should have parent and children keys
    const first = res.body.data[0];
    expect(first).toHaveProperty('parent');
    expect(first).toHaveProperty('children');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/categories', () => {
  const createdIds: number[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await prisma.category.delete({ where: { id } }).catch(() => null);
    }
  });

  it('creates a top-level category', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set(auth())
      .send({ name: 'TestCat Top', slug: `test-cat-top-${Date.now()}` });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('TestCat Top');
    expect(res.body.data.parent).toBeNull();
    createdIds.push(res.body.data.id);
  });

  it('creates a child category and returns parent info', async () => {
    const parentRes = await request(app)
      .post('/api/v1/categories')
      .set(auth())
      .send({ name: 'ParentCat', slug: `parent-cat-${Date.now()}` });
    const parentId = parentRes.body.data.id;
    createdIds.push(parentId);

    const childRes = await request(app)
      .post('/api/v1/categories')
      .set(auth())
      .send({ name: 'ChildCat', slug: `child-cat-${Date.now()}`, parentId });

    expect(childRes.status).toBe(201);
    expect(childRes.body.data.parent.id).toBe(parentId);
    createdIds.push(childRes.body.data.id);
  });

  it('auto-generates slug from name', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set(auth())
      .send({ name: 'AutoSlug Test Cat' });

    // slug may conflict if run multiple times; unique slug required
    if (res.status === 201) {
      expect(res.body.data.slug).toBe('autoslug-test-cat');
      createdIds.push(res.body.data.id);
    } else {
      // 409 if slug already exists from a prior test run — acceptable
      expect(res.status).toBe(409);
    }
  });

  it('returns 409 for duplicate slug', async () => {
    const slug = `dup-slug-${Date.now()}`;
    const first = await request(app)
      .post('/api/v1/categories')
      .set(auth())
      .send({ name: 'DupSlug1', slug });
    createdIds.push(first.body.data.id);

    const dup = await request(app)
      .post('/api/v1/categories')
      .set(auth())
      .send({ name: 'DupSlug2', slug });
    expect(dup.status).toBe(409);
  });

  it('returns 400 for missing name', async () => {
    const res = await request(app).post('/api/v1/categories').set(auth()).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/v1/categories/:id (soft-delete)', () => {
  it('soft-deletes a category and excludes it from list', async () => {
    const cat = await prisma.category.create({
      data: { name: 'DeleteCat', slug: `delete-cat-${Date.now()}` },
    });

    const del = await request(app).delete(`/api/v1/categories/${cat.id}`).set(auth());
    expect(del.status).toBe(204);

    const list = await request(app).get('/api/v1/categories').set(auth());
    const ids = (list.body.data as { id: number }[]).map((c) => c.id);
    expect(ids).not.toContain(cat.id);

    // GET by id should 404
    const get = await request(app).get(`/api/v1/categories/${cat.id}`).set(auth());
    expect(get.status).toBe(404);

    await prisma.category.delete({ where: { id: cat.id } });
  });
});

// ─── Product Types ────────────────────────────────────────────────────────────

describe('GET /api/v1/product-types', () => {
  it('returns list of active product types', async () => {
    const res = await request(app).get('/api/v1/product-types').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Seed has "Tyre"
    const names = (res.body.data as { name: string }[]).map((t) => t.name);
    expect(names).toContain('Tyre');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/product-types');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/product-types/:id/attributes', () => {
  it('returns Tyre attributes ordered by displayOrder', async () => {
    const type = await prisma.productType.findUniqueOrThrow({ where: { name: 'Tyre' } });

    const res = await request(app)
      .get(`/api/v1/product-types/${type.id}/attributes`)
      .set(auth());

    expect(res.status).toBe(200);
    const attrs = res.body.data as {
      code: string;
      datatype: string;
      isRequired: boolean;
      isVariantDefining: boolean;
      displayOrder: number;
      options: { value: string }[];
    }[];

    // 5 attributes from seed
    expect(attrs.length).toBe(5);

    // ordered by displayOrder
    for (let i = 1; i < attrs.length; i++) {
      expect(attrs[i].displayOrder).toBeGreaterThanOrEqual(attrs[i - 1].displayOrder);
    }

    const size = attrs.find((a) => a.code === 'size');
    expect(size).toBeDefined();
    expect(size!.datatype).toBe('ENUM');
    expect(size!.isRequired).toBe(true);
    expect(size!.isVariantDefining).toBe(true);
    expect(size!.options.map((o) => o.value)).toContain('195/65 R15');

    const pattern = attrs.find((a) => a.code === 'pattern');
    expect(pattern).toBeDefined();
    expect(pattern!.datatype).toBe('TEXT');
    expect(pattern!.options).toHaveLength(0);
  });

  it('returns 404 for non-existent product type', async () => {
    const res = await request(app)
      .get('/api/v1/product-types/999999/attributes')
      .set(auth());
    expect(res.status).toBe(404);
  });
});
