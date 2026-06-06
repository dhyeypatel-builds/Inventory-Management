/**
 * B-03 unit tests for the validate middleware.
 * No database or Express app needed — the middleware is tested in isolation.
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

const res = {} as Response;

describe('validate middleware', () => {
  describe('body validation', () => {
    const schema = z.object({ name: z.string().min(1), age: z.number().int().positive() });
    const mw = validate({ body: schema });

    it('calls next() with valid body', () => {
      const next = jest.fn() as NextFunction;
      const req = makeReq({ body: { name: 'Alice', age: 30 } });
      mw(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('passes a ZodError to next() when body is invalid', () => {
      const next = jest.fn() as NextFunction;
      const req = makeReq({ body: { name: '', age: -1 } });
      mw(req, res, next);
      const arg = (next as jest.Mock).mock.calls[0][0];
      expect(arg).toBeInstanceOf(z.ZodError);
    });

    it('returns 400 field details via the central error handler', () => {
      const next = jest.fn() as NextFunction;
      const req = makeReq({ body: { age: 'not-a-number' } }); // missing name, wrong type
      mw(req, res, next);
      const zodErr = (next as jest.Mock).mock.calls[0][0] as z.ZodError;
      expect(zodErr.errors.length).toBeGreaterThanOrEqual(1);
      const paths = zodErr.errors.map((e) => e.path.join('.'));
      expect(paths).toContain('name');
    });

    it('coerces and replaces req.body with parsed output', () => {
      const coerceSchema = z.object({ count: z.coerce.number() });
      const coerceMw = validate({ body: coerceSchema });
      const next = jest.fn() as NextFunction;
      const req = makeReq({ body: { count: '5' } });
      coerceMw(req, res, next);
      expect(req.body.count).toBe(5);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('query validation', () => {
    const schema = z.object({ page: z.coerce.number().int().positive().default(1) });
    const mw = validate({ query: schema });

    it('calls next() with a valid query string', () => {
      const next = jest.fn() as NextFunction;
      const req = makeReq({ query: { page: '2' } as Record<string, string> });
      mw(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('passes ZodError for invalid query value', () => {
      const next = jest.fn() as NextFunction;
      const req = makeReq({ query: { page: 'abc' } as Record<string, string> });
      mw(req, res, next);
      const arg = (next as jest.Mock).mock.calls[0][0];
      expect(arg).toBeInstanceOf(z.ZodError);
    });
  });

  describe('params validation', () => {
    const schema = z.object({ id: z.string().uuid() });
    const mw = validate({ params: schema });

    it('calls next() for a valid UUID param', () => {
      const next = jest.fn() as NextFunction;
      const req = makeReq({ params: { id: 'a7b8c9d0-1234-5678-abcd-ef0123456789' } });
      mw(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('passes ZodError for a non-UUID param', () => {
      const next = jest.fn() as NextFunction;
      const req = makeReq({ params: { id: 'not-a-uuid' } });
      mw(req, res, next);
      const arg = (next as jest.Mock).mock.calls[0][0];
      expect(arg).toBeInstanceOf(z.ZodError);
    });
  });

  describe('combined body + query + params', () => {
    const mw = validate({
      body: z.object({ value: z.number() }),
      query: z.object({ format: z.enum(['json', 'csv']) }),
      params: z.object({ id: z.string().min(1) }),
    });

    it('validates all three simultaneously when all are valid', () => {
      const next = jest.fn() as NextFunction;
      const req = makeReq({
        body: { value: 42 },
        query: { format: 'json' } as Record<string, string>,
        params: { id: 'some-id' },
      });
      mw(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('fails fast on body error even if query and params are valid', () => {
      const next = jest.fn() as NextFunction;
      const req = makeReq({
        body: { value: 'not-a-number' },
        query: { format: 'csv' } as Record<string, string>,
        params: { id: 'x' },
      });
      mw(req, res, next);
      expect((next as jest.Mock).mock.calls[0][0]).toBeInstanceOf(z.ZodError);
    });
  });
});
