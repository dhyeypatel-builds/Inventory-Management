import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../modules/auth/auth.service';
import { runWithTenant } from '../tenancy/context';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * Guards the platform (master-admin) endpoints. Verifies the Bearer JWT, requires
 * the `platform` claim, populates `req.platformAdmin`, and enters a platform
 * tenant-context (scoping bypass) for the request. Tenant-user tokens — including
 * impersonation tokens, which carry no `platform` claim — are rejected with 403.
 */
export function requirePlatform(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or invalid authorization header'));
    return;
  }

  let payload;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch {
    next(new UnauthorizedError('Invalid or expired access token'));
    return;
  }

  if (!payload.platform) {
    next(new ForbiddenError('Platform admin access required'));
    return;
  }

  req.platformAdmin = { id: payload.sub };
  runWithTenant({ tenantId: null, platform: true }, () => next());
}
