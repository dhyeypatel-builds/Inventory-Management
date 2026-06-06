import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../modules/auth/auth.service';
import { runWithTenant } from '../tenancy/context';
import { UnauthorizedError } from '../utils/errors';

/**
 * Verifies the Bearer JWT in the Authorization header and populates req.user.
 * Responds 401 if the token is missing, malformed, or expired.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or invalid authorization header'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      permissions: payload.permissions,
      tenantId: payload.tenantId,
    };
    // Enter the tenant context for the remainder of the request. Dormant in
    // Stage 2 — populated here, but no query reads it until the Stage 3 scoping
    // extension is enabled.
    runWithTenant(
      { tenantId: payload.tenantId ?? null, platform: false },
      () => next(),
    );
  } catch {
    next(new UnauthorizedError('Invalid or expired access token'));
  }
}
