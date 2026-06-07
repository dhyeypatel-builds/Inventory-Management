import { prisma } from '../../db/prisma';
import { verifyPassword, signAccessToken } from '../auth/auth.service';
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

/** Verifies platform-admin credentials and issues a token with the `platform` claim. */
export async function platformLogin(email: string, password: string): Promise<PlatformLoginResult> {
  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  if (!admin || !admin.isActive || !admin.passwordHash) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const valid = await verifyPassword(admin.passwordHash, password);
  if (!valid) throw new UnauthorizedError('Invalid credentials');

  await prisma.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

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
 */
export async function signImpersonationToken(adminId: string, tenantId: string): Promise<string> {
  const adminRole = await prisma.role.findFirstOrThrow({
    where: { name: 'ADMIN' },
    include: { permissions: { include: { permission: true } } },
  });
  const permissions = adminRole.permissions.map((rp) => rp.permission.code);

  return signAccessToken({
    sub: adminId,
    role: 'ADMIN',
    permissions,
    tenantId,
    impersonatedBy: adminId,
  });
}
