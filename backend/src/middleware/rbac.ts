import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * Returns middleware that enforces all listed permission codes on req.user.
 * Must be used after the `authenticate` middleware.
 * - Missing authentication → 401
 * - Authenticated but lacking any permission → 403
 */
export function requirePermission(...codes: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    const missing = codes.filter((c) => !req.user!.permissions.includes(c));
    if (missing.length > 0) {
      next(new ForbiddenError(`Missing permission(s): ${missing.join(', ')}`));
      return;
    }

    next();
  };
}
