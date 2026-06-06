/**
 * B-02 tests for authenticate and requirePermission middleware.
 * Uses a minimal Express app with stub routes — no database required.
 */

import request from 'supertest';
import express from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { signAccessToken } from '../modules/auth/auth.service';
import { errorHandler } from '../middleware/error';
import { success } from '../utils/apiResponse';

// ─── Build a minimal test app ─────────────────────────────────────────────────

const testApp = express();
testApp.use(express.json());

// Route that only requires a valid token
testApp.get('/test/protected', authenticate, (req, res) => {
  success(res, { userId: req.user!.id, role: req.user!.role });
});

// Route that requires a specific permission
testApp.get(
  '/test/admin-only',
  authenticate,
  requirePermission('settings:write'),
  (_req, res) => {
    success(res, { ok: true });
  },
);

// Route that requires multiple permissions
testApp.get(
  '/test/multi-perm',
  authenticate,
  requirePermission('product:read', 'sale:create'),
  (_req, res) => {
    success(res, { ok: true });
  },
);

testApp.use(errorHandler);

// ─── authenticate middleware ──────────────────────────────────────────────────

describe('authenticate middleware', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const res = await request(testApp).get('/test/protected');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when scheme is not Bearer', async () => {
    const token = signAccessToken({ sub: 'u1', role: 'ADMIN', permissions: [] });
    const res = await request(testApp)
      .get('/test/protected')
      .set('Authorization', `Basic ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for a malformed token string', async () => {
    const res = await request(testApp)
      .get('/test/protected')
      .set('Authorization', 'Bearer not.a.real.jwt');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for a tampered token', async () => {
    const token = signAccessToken({ sub: 'u1', role: 'ADMIN', permissions: [] });
    const tampered = token.slice(0, -4) + 'XXXX';
    const res = await request(testApp)
      .get('/test/protected')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('returns 200 and populates req.user with a valid token', async () => {
    const token = signAccessToken({
      sub: 'user-uuid-42',
      role: 'ADMIN',
      permissions: ['product:read'],
    });
    const res = await request(testApp)
      .get('/test/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe('user-uuid-42');
    expect(res.body.data.role).toBe('ADMIN');
  });
});

// ─── requirePermission middleware ─────────────────────────────────────────────

describe('requirePermission middleware', () => {
  it('returns 403 when user lacks required permission', async () => {
    const token = signAccessToken({
      sub: 'u1',
      role: 'ADMIN',
      permissions: ['product:read'],
    });
    const res = await request(testApp)
      .get('/test/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 200 when user has the required permission', async () => {
    const token = signAccessToken({
      sub: 'u1',
      role: 'ADMIN',
      permissions: ['settings:write'],
    });
    const res = await request(testApp)
      .get('/test/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
  });

  it('returns 403 when only some of multiple required permissions are held', async () => {
    const token = signAccessToken({
      sub: 'u1',
      role: 'ADMIN',
      permissions: ['product:read'], // missing sale:create
    });
    const res = await request(testApp)
      .get('/test/multi-perm')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 when user holds all multiple required permissions', async () => {
    const token = signAccessToken({
      sub: 'u1',
      role: 'ADMIN',
      permissions: ['product:read', 'sale:create'],
    });
    const res = await request(testApp)
      .get('/test/multi-perm')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('returns 401 when requirePermission is called without authenticate', async () => {
    // Standalone requirePermission without req.user set
    const bareApp = express();
    bareApp.use(express.json());
    bareApp.get('/bare', requirePermission('product:read'), (_req, res) => {
      success(res, { ok: true });
    });
    bareApp.use(errorHandler);

    const res = await request(bareApp).get('/bare');
    expect(res.status).toBe(401);
  });
});
