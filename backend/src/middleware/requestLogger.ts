import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * One structured log line per request, emitted on completion. Includes the
 * tenant the request ran under (set on `req.user` by `authenticate`) so
 * production logs are debuggable per shop (Phase 2A W-03). Health checks are
 * skipped to keep the stream quiet.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/api/v1/health') {
    next();
    return;
  }

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(
      {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
        tenantId: req.user?.tenantId ?? null,
        userId: req.user?.id ?? null,
      },
      'request',
    );
  });

  next();
}
