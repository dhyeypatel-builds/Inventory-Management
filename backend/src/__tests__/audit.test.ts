/**
 * B-03 tests for the auditLog middleware.
 * Prisma is mocked so no database is required.
 */

const mockAuditLogCreate = jest.fn().mockResolvedValue({});

jest.mock('../db/prisma', () => ({
  prisma: {
    auditLog: { create: mockAuditLogCreate },
  },
}));

import request from 'supertest';
import express from 'express';
import { auditLog } from '../middleware/audit';
import { authenticate } from '../middleware/auth';
import { signAccessToken } from '../modules/auth/auth.service';
import { errorHandler } from '../middleware/error';
import { success } from '../utils/apiResponse';

// ─── Minimal test app ─────────────────────────────────────────────────────────

const testApp = express();
testApp.use(express.json());

// Unauthenticated mutation (no req.user)
testApp.post('/test/items', auditLog('item'), (req, res) => {
  res.locals.auditEntityId = 'entity-123';
  res.locals.auditAfter = { created: true };
  success(res, { id: 'entity-123' }, 201);
});

// Authenticated mutation
testApp.put(
  '/test/items/:id',
  authenticate,
  auditLog('item'),
  (req, res) => {
    res.locals.auditAfter = { updated: true };
    success(res, { id: req.params.id });
  },
);

// Mutation that returns 4xx — should NOT write audit log
testApp.post('/test/bad', auditLog('item'), (_req, res) => {
  res.status(400).json({ success: false, error: { code: 'BAD', message: 'bad' } });
});

testApp.use(errorHandler);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wait for the res.finish event to propagate (audit write is async). */
const tick = () => new Promise<void>((r) => setImmediate(r));

describe('auditLog middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes an audit_log row after a successful POST', async () => {
    await request(testApp)
      .post('/test/items')
      .send({ name: 'Widget' });

    await tick();

    expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
    const arg = mockAuditLogCreate.mock.calls[0][0].data;
    expect(arg.action).toBe('CREATE');
    expect(arg.entityType).toBe('item');
    expect(arg.entityId).toBe('entity-123');
    expect(arg.afterData).toEqual({ created: true });
    expect(arg.beforeData).toMatchObject({ name: 'Widget' });
    expect(arg.actorId).toBeNull(); // no req.user
  });

  it('records actorId from req.user when authenticated', async () => {
    const token = signAccessToken({
      sub: 'user-uuid-99',
      role: 'ADMIN',
      permissions: [],
    });

    await request(testApp)
      .put('/test/items/item-abc')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });

    await tick();

    const arg = mockAuditLogCreate.mock.calls[0][0].data;
    expect(arg.action).toBe('UPDATE');
    expect(arg.actorId).toBe('user-uuid-99');
    expect(arg.entityId).toBe('item-abc');
  });

  it('does NOT write an audit_log row when the response is 4xx', async () => {
    await request(testApp)
      .post('/test/bad')
      .send({ name: 'Fail' });

    await tick();

    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });
});
