/**
 * Phase 2A W-03: the request logger attaches the tenant to each request line.
 */
import { EventEmitter } from 'events';
import type { Request, Response, NextFunction } from 'express';
import { requestLogger } from '../middleware/requestLogger';
import { logger } from '../config/logger';

function fakeReq(overrides: Partial<Request>): Request {
  return {
    method: 'GET',
    path: '/api/v1/products',
    originalUrl: '/api/v1/products',
    ...overrides,
  } as Request;
}

describe('requestLogger', () => {
  afterEach(() => jest.restoreAllMocks());

  it('logs tenantId and userId on response finish', () => {
    const spy = jest.spyOn(logger, 'info').mockReturnValue(undefined as never);
    const req = fakeReq({
      user: { id: 'u1', tenantId: 't1', role: 'ADMIN', permissions: [] },
    });
    const res = new EventEmitter() as unknown as Response;
    (res as unknown as { statusCode: number }).statusCode = 201;
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    res.emit('finish');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', userId: 'u1', status: 201, method: 'GET' }),
      'request',
    );
  });

  it('skips health checks', () => {
    const spy = jest.spyOn(logger, 'info');
    const req = fakeReq({ path: '/api/v1/health', originalUrl: '/api/v1/health' });
    const res = new EventEmitter() as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
  });
});
