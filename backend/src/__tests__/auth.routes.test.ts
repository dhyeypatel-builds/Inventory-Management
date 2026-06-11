/**
 * B-04 integration tests for /api/v1/auth endpoints.
 *
 * Prerequisites (same as db.test.ts):
 *   docker compose -f docker-compose.dev.yml up -d
 *   npx prisma migrate deploy
 *   npx prisma db seed          ← creates ADMIN role
 *
 * A dedicated test user is created in beforeAll and deleted in afterAll
 * so these tests never corrupt seeded admin credentials.
 */

import request from 'supertest';
import { app } from '../app';
import { prisma } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';

// ─── Test-user fixture ────────────────────────────────────────────────────────

const TEST_EMAIL = 'auth-test-user@tyrestock.test';
const TEST_PASSWORD = 'TestPass@99';
const TEST_FULL_NAME = 'Auth Test User';

let testUserId: string;

beforeAll(async () => {
  // Ensure ADMIN role exists (seed must have been run)
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });

  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, failedLogins: 0, isActive: true },
    create: {
      email: TEST_EMAIL,
      fullName: TEST_FULL_NAME,
      passwordHash,
      roleId: adminRole.id,
    },
  });
  testUserId = user.id;
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });
  await prisma.user.delete({ where: { id: testUserId } });
  await prisma.$disconnect();
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('returns 200 with token pair + user profile on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { accessToken, refreshToken, user } = res.body.data;
    expect(typeof accessToken).toBe('string');
    expect(typeof refreshToken).toBe('string');
    expect(user.email).toBe(TEST_EMAIL);
    expect(user.role).toBe('ADMIN');
    expect(Array.isArray(user.permissions)).toBe(true);
    expect(user.permissions.length).toBeGreaterThan(0);
    // Password hash must never appear in the response
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: 'WrongPassword1!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for missing/invalid body fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('increments failedLogins counter on each wrong password', async () => {
    await prisma.user.update({
      where: { id: testUserId },
      data: { failedLogins: 0 },
    });

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: 'WrongPassword!' });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: testUserId } });
    expect(user.failedLogins).toBe(1);

    // Cleanup
    await prisma.user.update({ where: { id: testUserId }, data: { failedLogins: 0 } });
  });

  it('returns 401 ACCOUNT_LOCKED after N failed attempts', async () => {
    const max = Number(process.env.AUTH_MAX_FAILED_LOGINS ?? 5);

    await prisma.user.update({
      where: { id: testUserId },
      data: { failedLogins: max },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');

    // Unlock for subsequent tests
    await prisma.user.update({ where: { id: testUserId }, data: { failedLogins: 0 } });
  });
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  let refreshToken: string;

  beforeEach(async () => {
    await prisma.user.update({ where: { id: testUserId }, data: { failedLogins: 0 } });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    refreshToken = res.body.data.refreshToken;
  });

  it('returns a new token pair and revokes the old refresh token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
  });

  it('tolerates immediate reuse after rotation (parallel-tab grace window)', async () => {
    // First rotation — consumes the original token
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    // Second attempt right away: a benign race, not theft → fresh pair
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
  });

  it('returns 401 when a refresh token is reused well after rotation', async () => {
    // First rotation — consumes the original token
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    // Push the revocation outside the grace window
    await prisma.refreshToken.updateMany({
      where: { userId: testUserId, revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    // Stale reuse → theft signal
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });

  it('returns 400 for a missing refreshToken field', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('returns 204 and the token can no longer be refreshed', async () => {
    await prisma.user.update({ where: { id: testUserId }, data: { failedLogins: 0 } });
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const { refreshToken } = loginRes.body.data;

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken });
    expect(logoutRes.status).toBe(204);

    // Token should now be revoked
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('returns 204 even for an already-expired or invalid token (graceful)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'not.a.real.token' });
    expect(res.status).toBe(204);
  });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  let accessToken: string;

  beforeEach(async () => {
    await prisma.user.update({ where: { id: testUserId }, data: { failedLogins: 0 } });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    accessToken = res.body.data.accessToken;
  });

  it('returns current user profile with permissions', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(TEST_EMAIL);
    expect(res.body.data.role).toBe('ADMIN');
    expect(Array.isArray(res.body.data.permissions)).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

// ─── POST /auth/change-password ───────────────────────────────────────────────

describe('POST /api/v1/auth/change-password', () => {
  let accessToken: string;

  beforeEach(async () => {
    // Reset password to known value before each test
    const { hashPassword: hp } = await import('../modules/auth/auth.service');
    await prisma.user.update({
      where: { id: testUserId },
      data: { passwordHash: await hp(TEST_PASSWORD), failedLogins: 0 },
    });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    accessToken = res.body.data.accessToken;
  });

  it('returns 204 and the new password works for subsequent login', async () => {
    const newPassword = 'NewPass@2026!';

    const changeRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword });

    expect(changeRes.status).toBe(204);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: newPassword });

    expect(loginRes.status).toBe(200);
  });

  it('returns 401 for a wrong current password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'WrongCurrent!', newPassword: 'NewPass@2026!' });

    expect(res.status).toBe(401);
  });

  it('returns 400 for passwords shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'NewPass@2026!' });

    expect(res.status).toBe(401);
  });
});
