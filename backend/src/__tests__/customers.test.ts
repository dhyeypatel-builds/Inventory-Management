/**
 * E-01 integration tests for /customers.
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

const TEST_EMAIL = 'customers-test-user@tyrestock.test';
const TEST_PASSWORD = 'CustomerPass@99';

let accessToken: string;
let testUserId: string;

const createdCustomerIds: string[] = [];

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, failedLogins: 0, isActive: true },
    create: {
      email: TEST_EMAIL,
      fullName: 'Customers Test User',
      passwordHash,
      roleId: adminRole.id,
    },
  });
  testUserId = user.id;

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  accessToken = loginRes.body.data.accessToken as string;
});

afterAll(async () => {
  await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);
  await prisma.$disconnect();
});

// ─── POST /customers ─────────────────────────────────────────────────────────

describe('POST /api/v1/customers', () => {
  it('creates a customer with valid data', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set(auth())
      .send({
        name: 'Ramesh Kumar',
        phone: '+919876543210',
        email: 'ramesh@example.com',
        vehicleNo: 'GJ01AB1234',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Ramesh Kumar',
      phone: '+919876543210',
      email: 'ramesh@example.com',
    });
    expect(res.body.data.id).toBeDefined();
    createdCustomerIds.push(res.body.data.id);
  });

  it('rejects a missing name with 400', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set(auth())
      .send({ phone: '9876543210' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid email with 400', async () => {
    const res = await request(app)
      .post('/api/v1/customers')
      .set(auth())
      .send({ name: 'Bad Email', email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/customers').send({ name: 'No Auth' });
    expect(res.status).toBe(401);
  });
});

// ─── GET /customers ──────────────────────────────────────────────────────────

describe('GET /api/v1/customers', () => {
  beforeAll(async () => {
    for (const c of [
      { name: 'Search Alpha Tyres', phone: '+911111111111' },
      { name: 'Search Beta Motors', phone: '+912222222222' },
    ]) {
      const res = await request(app).post('/api/v1/customers').set(auth()).send(c);
      createdCustomerIds.push(res.body.data.id);
    }
  });

  it('returns a paginated list', async () => {
    const res = await request(app).get('/api/v1/customers').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1 });
  });

  it('searches by name', async () => {
    const res = await request(app).get('/api/v1/customers?q=Search+Alpha').set(auth());
    expect(res.status).toBe(200);
    const names = (res.body.data as { name: string }[]).map((c) => c.name);
    expect(names).toContain('Search Alpha Tyres');
    expect(names).not.toContain('Search Beta Motors');
  });

  it('searches by phone', async () => {
    const res = await request(app).get('/api/v1/customers?q=2222222222').set(auth());
    expect(res.status).toBe(200);
    const names = (res.body.data as { name: string }[]).map((c) => c.name);
    expect(names).toContain('Search Beta Motors');
  });
});

// ─── GET /customers/:id (with history) ───────────────────────────────────────

describe('GET /api/v1/customers/:id', () => {
  it('returns a customer with recentSales history', async () => {
    const res = await request(app)
      .get(`/api/v1/customers/${createdCustomerIds[0]}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdCustomerIds[0]);
    expect(Array.isArray(res.body.data.recentSales)).toBe(true);
  });

  it('returns 404 for an unknown customer', async () => {
    const res = await request(app)
      .get('/api/v1/customers/00000000-0000-0000-0000-000000000000')
      .set(auth());
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /customers/:id ────────────────────────────────────────────────────

describe('PATCH /api/v1/customers/:id', () => {
  it('updates customer fields', async () => {
    const res = await request(app)
      .patch(`/api/v1/customers/${createdCustomerIds[0]}`)
      .set(auth())
      .send({ address: 'Shop 12, Market Road', notes: 'Prefers UPI' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ address: 'Shop 12, Market Road', notes: 'Prefers UPI' });
  });

  it('rejects an empty patch body with 400', async () => {
    const res = await request(app)
      .patch(`/api/v1/customers/${createdCustomerIds[0]}`)
      .set(auth())
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /customers/:id (soft-delete) ─────────────────────────────────────

describe('DELETE /api/v1/customers/:id', () => {
  it('soft-deletes a customer and excludes it from list', async () => {
    const createRes = await request(app)
      .post('/api/v1/customers')
      .set(auth())
      .send({ name: 'To Be Deleted' });
    const id = createRes.body.data.id as string;
    createdCustomerIds.push(id);

    const delRes = await request(app).delete(`/api/v1/customers/${id}`).set(auth());
    expect(delRes.status).toBe(204);

    const getRes = await request(app).get(`/api/v1/customers/${id}`).set(auth());
    expect(getRes.status).toBe(404);

    const row = await prisma.customer.findUniqueOrThrow({ where: { id } });
    expect(row.deletedAt).not.toBeNull();
  });
});
