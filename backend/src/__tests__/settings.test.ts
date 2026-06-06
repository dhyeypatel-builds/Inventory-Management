/**
 * F-04 integration tests for /settings.
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

const TEST_EMAIL = 'settings-test-user@tyrestock.test';
const TEST_PASSWORD = 'SettingsPass@99';

let accessToken: string;
let testUserId: string;

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

// Snapshot of the keys this suite mutates, restored in afterAll.
const MUTATED_KEYS = ['tax.default_pct', 'inventory.default_reorder_level', 'company.name'];
let originalValues: Record<string, unknown> = {};

beforeAll(async () => {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, failedLogins: 0, isActive: true },
    create: { email: TEST_EMAIL, fullName: 'Settings Test User', passwordHash, roleId: adminRole.id },
  });
  testUserId = user.id;

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  accessToken = loginRes.body.data.accessToken as string;

  const rows = await prisma.setting.findMany({ where: { key: { in: MUTATED_KEYS } } });
  originalValues = Object.fromEntries(rows.map((r) => [r.key, r.value]));
});

afterAll(async () => {
  for (const key of MUTATED_KEYS) {
    if (key in originalValues) {
      await prisma.setting.updateMany({ where: { key }, data: { value: originalValues[key] as object } });
    }
  }
  await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);
  await prisma.$disconnect();
});

// ─── GET /settings ──────────────────────────────────────────────────────────

describe('GET /api/v1/settings', () => {
  it('returns settings grouped by prefix', async () => {
    const res = await request(app).get('/api/v1/settings').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('company');
    expect(res.body.data).toHaveProperty('tax');
    expect(res.body.data).toHaveProperty('inventory');
    expect(typeof res.body.data.tax.default_pct).toBe('number');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/settings');
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /settings ──────────────────────────────────────────────────────────

describe('PATCH /api/v1/settings', () => {
  it('updates tax %, reorder level, and company profile, and persists them', async () => {
    const res = await request(app)
      .patch('/api/v1/settings')
      .set(auth())
      .send({
        tax: { default_pct: 12 },
        inventory: { default_reorder_level: 8 },
        company: { name: 'Settings Test Co' },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.tax.default_pct).toBe(12);
    expect(res.body.data.inventory.default_reorder_level).toBe(8);
    expect(res.body.data.company.name).toBe('Settings Test Co');

    // Persisted to the DB.
    const taxRow = await prisma.setting.findFirstOrThrow({ where: { key: 'tax.default_pct' } });
    expect(taxRow.value).toBe(12);
    const reorderRow = await prisma.setting.findFirstOrThrow({
      where: { key: 'inventory.default_reorder_level' },
    });
    expect(reorderRow.value).toBe(8);
  });

  it('rejects a tax percentage above 100 with 400', async () => {
    const res = await request(app)
      .patch('/api/v1/settings')
      .set(auth())
      .send({ tax: { default_pct: 101 } });
    expect(res.status).toBe(400);
  });

  it('rejects a negative reorder level with 400', async () => {
    const res = await request(app)
      .patch('/api/v1/settings')
      .set(auth())
      .send({ inventory: { default_reorder_level: -1 } });
    expect(res.status).toBe(400);
  });

  it('rejects an empty body with 400', async () => {
    const res = await request(app).patch('/api/v1/settings').set(auth()).send({});
    expect(res.status).toBe(400);
  });

  it('rejects an unknown setting key with 400', async () => {
    const res = await request(app)
      .patch('/api/v1/settings')
      .set(auth())
      .send({ tax: { unknown_field: 5 } });
    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .patch('/api/v1/settings')
      .send({ tax: { default_pct: 10 } });
    expect(res.status).toBe(401);
  });
});
