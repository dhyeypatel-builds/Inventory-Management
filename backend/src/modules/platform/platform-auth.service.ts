import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { verifyPassword, signAccessToken, LOCKOUT_MINUTES } from '../auth/auth.service';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';

export interface PlatformAdminProfile {
  id: string;
  email: string;
  fullName: string;
  lastLoginAt: Date | null;
}

export interface PlatformLoginResult {
  accessToken: string;
  admin: Omit<PlatformAdminProfile, 'lastLoginAt'>;
}

/**
 * Verifies platform-admin credentials and issues a token with the `platform`
 * claim. Same time-based lockout policy as tenant users — this is the most
 * powerful account in the system, so failures count and lock, and every error
 * is the same generic message.
 */
export async function platformLogin(email: string, password: string): Promise<PlatformLoginResult> {
  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  if (!admin || !admin.isActive || !admin.passwordHash) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const now = new Date();
  if (admin.lockedUntil && admin.lockedUntil > now) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const valid = await verifyPassword(admin.passwordHash, password);
  if (!valid) {
    const priorFails = admin.lockedUntil && admin.lockedUntil <= now ? 0 : admin.failedLogins;
    const failedLogins = priorFails + 1;
    const lockedUntil =
      failedLogins >= env.AUTH_MAX_FAILED_LOGINS
        ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000)
        : null;
    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { failedLogins, lockedUntil },
    });
    throw new UnauthorizedError('Invalid credentials');
  }

  await prisma.platformAdmin.update({
    where: { id: admin.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const accessToken = signAccessToken({
    sub: admin.id,
    role: 'PLATFORM_ADMIN',
    permissions: [],
    platform: true,
  });

  return { accessToken, admin: { id: admin.id, email: admin.email, fullName: admin.fullName } };
}

export async function getPlatformAdmin(id: string): Promise<PlatformAdminProfile> {
  const admin = await prisma.platformAdmin.findUnique({ where: { id } });
  if (!admin) throw new NotFoundError('Platform admin');
  return { id: admin.id, email: admin.email, fullName: admin.fullName, lastLoginAt: admin.lastLoginAt };
}

/**
 * Issues an impersonation token: a normal tenant-ADMIN session for `tenantId`,
 * granted to the platform admin. Carries `impersonatedBy` for audit/banner. It
 * has NO `platform` claim, so it cannot reach the platform-admin endpoints.
 *
 * `sub` is the tenant's own (oldest-ADMIN) user — not the platform admin —
 * so writes that FK `created_by` → users (sales, purchases) work while
 * impersonating. Attribution to the real actor lives in `impersonatedBy` and
 * the IMPERSONATE_START platform audit entry.
 */
export async function signImpersonationToken(adminId: string, tenantId: string): Promise<string> {
  const adminRole = await prisma.role.findFirstOrThrow({
    where: { name: 'ADMIN' },
    include: { permissions: { include: { permission: true } } },
  });
  const permissions = adminRole.permissions.map((rp) => rp.permission.code);

  const tenantOwner = await prisma.user.findFirst({
    where: { tenantId, roleId: adminRole.id },
    orderBy: { createdAt: 'asc' },
  });
  if (!tenantOwner) {
    throw new NotFoundError('Tenant admin user (cannot impersonate an ownerless tenant)');
  }

  return signAccessToken({
    sub: tenantOwner.id,
    role: 'ADMIN',
    permissions,
    tenantId,
    impersonatedBy: adminId,
  });
}
