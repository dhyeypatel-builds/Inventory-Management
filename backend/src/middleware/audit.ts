import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { logger } from '../config/logger';

/**
 * Returns a middleware that writes an audit_log row AFTER a mutating request
 * completes. Call with the entity type (e.g. 'product', 'sale').
 *
 * Usage: router.post('/', auditLog('product'), controller)
 *
 * The middleware captures req.body as before_data. Controllers can attach
 * res.locals.auditAfter = <serializable> to record the after state.
 */
export const auditLog =
  (entityType: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const beforeData = req.body ?? null;

    res.on('finish', () => {
      if (res.statusCode >= 400) return; // don't log failed mutations

      const action = methodToAction(req.method);
      const entityId =
        (res.locals.auditEntityId as string | undefined) ??
        (req.params.id !== undefined ? String(req.params.id) : null);
      const afterData = (res.locals.auditAfter as unknown) ?? null;

      prisma.auditLog
        .create({
          data: {
            actorId: req.user?.id ?? null,
            action,
            entityType,
            entityId,
            beforeData: beforeData ? (beforeData as object) : undefined,
            afterData: afterData ? (afterData as object) : undefined,
            ipAddress: req.ip ?? null,
            userAgent: req.headers['user-agent'] ?? null,
          },
        })
        .catch((err: unknown) => logger.error({ err }, 'Failed to write audit log'));
    });

    next();
  };

const methodToAction = (method: string): string => {
  switch (method.toUpperCase()) {
    case 'POST':   return 'CREATE';
    case 'PUT':
    case 'PATCH':  return 'UPDATE';
    case 'DELETE': return 'DELETE';
    default:       return method.toUpperCase();
  }
};
