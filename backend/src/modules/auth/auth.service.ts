import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { AppError, NotFoundError, UnauthorizedError } from '../../utils/errors';

// ─── Password helpers ─────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

// ─── Access token ─────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: string;
  role: string;
  permissions: string[];
  /**
   * The tenant the token's user belongs to. Optional because Phase 2B
   * platform-admin tokens carry no tenant (they use a `platform` claim instead).
   * Always set for tenant-user tokens issued by `login` / refresh.
   */
  tenantId?: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

// ─── Refresh token ────────────────────────────────────────────────────────────

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

/**
 * Signs a new refresh token, hashes it, and persists the record.
 * Returns the raw token (to be sent to the client once) and the record id.
 */
export async function signRefreshToken(
  userId: string,
): Promise<{ token: string; tokenId: string }> {
  const tokenId = randomUUID();
  const token = jwt.sign(
    { sub: userId, jti: tokenId } satisfies RefreshTokenPayload,
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );

  const tokenHash = await argon2.hash(token, { type: argon2.argon2id });
  const expiresAt = new Date(Date.now() + parseExpiresIn(env.JWT_REFRESH_EXPIRES_IN));

  await prisma.refreshToken.create({
    data: { id: tokenId, userId, tokenHash, expiresAt },
  });

  return { token, tokenId };
}

/**
 * Validates a refresh token, revokes it, and issues a fresh pair.
 * Reuse of a revoked token triggers a full-family revocation (token theft signal).
 */
export async function rotateRefreshToken(
  token: string,
): Promise<{ token: string; tokenId: string; userId: string }> {
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });

  if (!stored) {
    throw new UnauthorizedError('Refresh token not found');
  }

  if (stored.revokedAt !== null) {
    // Possible token theft — revoke all active tokens for this user
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AppError(401, 'AUTH_TOKEN_REUSE', 'Refresh token reuse detected');
  }

  if (stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token has expired');
  }

  // Revoke consumed token
  await prisma.refreshToken.update({
    where: { id: payload.jti },
    data: { revokedAt: new Date() },
  });

  const next = await signRefreshToken(stored.userId);
  return { ...next, userId: stored.userId };
}

/**
 * Revokes a single refresh token by id (used on logout).
 */
export async function revokeRefreshToken(tokenId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { id: tokenId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revokes all active refresh tokens for a user (used on password change / security events).
 */
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ─── Higher-level auth flows ──────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  tenantId: string;
  fullName: string;
  email: string;
  role: string;
  permissions: string[];
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: Omit<UserProfile, 'lastLoginAt' | 'createdAt'>;
}

/** Fetches user with role+permissions for use in login and getMe. */
async function findUserWithPermissions(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      role: {
        include: { permissions: { include: { permission: true } } },
      },
    },
  });
}

/**
 * Verifies credentials, enforces lockout policy, returns token pair + profile.
 * Never exposes which field was wrong — always "Invalid credentials".
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      tenant: true,
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid credentials');
  }

  if (user.failedLogins >= env.AUTH_MAX_FAILED_LOGINS) {
    throw new AppError(401, 'ACCOUNT_LOCKED', 'Account locked due to too many failed attempts');
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: { increment: 1 } },
    });
    throw new UnauthorizedError('Invalid credentials');
  }

  // Block sign-in for a suspended tenant (only after valid credentials, so the
  // tenant's status is never leaked to wrong-password attempts).
  if (user.tenant.status === 'SUSPENDED') {
    throw new AppError(403, 'TENANT_SUSPENDED', 'This shop account is suspended');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lastLoginAt: new Date() },
  });

  const permissions = user.role.permissions.map((rp) => rp.permission.code);
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role.name,
    permissions,
    tenantId: user.tenantId,
  });
  const { token: refreshToken } = await signRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      fullName: user.fullName,
      email: user.email,
      role: user.role.name,
      permissions,
    },
  };
}

/** Revokes the presented refresh token (best-effort; invalid tokens are silently ignored). */
export async function logout(refreshToken: string): Promise<void> {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    await revokeRefreshToken(payload.jti);
  } catch {
    // Expired or invalid token — nothing to revoke
  }
}

/** Returns the current user's full profile with permissions. */
export async function getMe(userId: string): Promise<UserProfile> {
  let user;
  try {
    user = await findUserWithPermissions(userId);
  } catch {
    throw new NotFoundError('User');
  }
  const permissions = user.role.permissions.map((rp) => rp.permission.code);
  return {
    id: user.id,
    tenantId: user.tenantId,
    fullName: user.fullName,
    email: user.email,
    role: user.role.name,
    permissions,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

/**
 * Changes a user's password after verifying the current one.
 * Revokes all refresh tokens to force re-login on all devices.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) throw new UnauthorizedError('Current password is incorrect');

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
  await revokeAllRefreshTokens(userId);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseExpiresIn(expiresIn: string): number {
  const unit = expiresIn.slice(-1);
  const value = parseInt(expiresIn.slice(0, -1), 10);
  switch (unit) {
    case 's': return value * 1_000;
    case 'm': return value * 60 * 1_000;
    case 'h': return value * 60 * 60 * 1_000;
    case 'd': return value * 24 * 60 * 60 * 1_000;
    default:  return parseInt(expiresIn, 10) * 1_000;
  }
}
