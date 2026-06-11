import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
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
  /** True for platform-admin (master admin) tokens — Phase 2B. */
  platform?: boolean;
  /** Set on an impersonation token: the platform admin "viewing as" this tenant. */
  impersonatedBy?: string;
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

/** Reuse of a just-rotated token within this window is treated as a benign race. */
const REFRESH_REUSE_GRACE_MS = 30_000;

/**
 * Validates a refresh token, revokes it, and issues a fresh pair.
 * Reuse of a revoked token triggers a full-family revocation (token theft signal),
 * unless the reuse happens within a short grace window (parallel-tab race).
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
    // A rotation-consumed token reused moments later is almost always a benign
    // race (two tabs refreshing at once, or a retried request) — not theft.
    // Issue a fresh pair instead of nuking the session. Tokens revoked by
    // logout/suspension (no replacedById) never qualify.
    const reuseAgeMs = Date.now() - stored.revokedAt.getTime();
    if (stored.replacedById !== null && reuseAgeMs <= REFRESH_REUSE_GRACE_MS) {
      const next = await signRefreshToken(stored.userId);
      return { ...next, userId: stored.userId };
    }

    // Stale or non-rotation reuse — possible token theft. Revoke all active
    // tokens for this user.
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AppError(401, 'AUTH_TOKEN_REUSE', 'Refresh token reuse detected');
  }

  if (stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token has expired');
  }

  const next = await signRefreshToken(stored.userId);

  // Revoke the consumed token, marking it as rotated (vs logout/suspend)
  await prisma.refreshToken.update({
    where: { id: payload.jti },
    data: { revokedAt: new Date(), replacedById: next.tokenId },
  });

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
  tenantName: string;
  /** null until the shop finishes the onboarding wizard (Phase 2C ON-01). */
  onboardingCompletedAt: Date | null;
  fullName: string;
  email: string;
  role: string;
  permissions: string[];
  /** False for passwordless (invited) users — they sign in via OTP only. */
  hasPassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: Omit<UserProfile, 'lastLoginAt' | 'createdAt'>;
}

/** Fetches user with tenant+role+permissions for use in login and getMe. */
async function findUserWithPermissions(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      tenant: true,
      role: {
        include: { permissions: { include: { permission: true } } },
      },
    },
  });
}

const userInclude = {
  tenant: true,
  role: { include: { permissions: { include: { permission: true } } } },
} as const;

type LoginUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;

/** Loads a user (by email) with everything needed to mint a session, or null. */
export async function loadUserForLogin(email: string): Promise<LoginUser | null> {
  return prisma.user.findUnique({ where: { email }, include: userInclude });
}

/**
 * Shared session finalizer used by every login method (password, OTP, Google,
 * invite accept). Enforces the active-user + non-suspended-tenant gates, records
 * the login, marks any open invite for this email accepted, and mints the pair.
 */
export async function finalizeSession(user: LoginUser): Promise<LoginResult> {
  if (!user.isActive) {
    throw new UnauthorizedError('Invalid credentials');
  }
  if (user.tenant.status === 'SUSPENDED') {
    throw new AppError(
      403,
      'TENANT_SUSPENDED',
      'This shop account is suspended. Please contact support to reactivate it.',
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  // First successful sign-in by an invited user closes their open invite(s).
  await prisma.invite.updateMany({
    where: { email: user.email, acceptedAt: null },
    data: { acceptedAt: new Date() },
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
      tenantName: user.tenant.name,
      onboardingCompletedAt: user.tenant.onboardingCompletedAt,
      fullName: user.fullName,
      email: user.email,
      role: user.role.name,
      permissions,
      hasPassword: user.passwordHash !== null,
    },
  };
}

/** Issues a session for a known user id (used by OTP/Google/invite after proof). */
export async function issueSessionForUserId(userId: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
  if (!user) throw new NotFoundError('User');
  return finalizeSession(user);
}

/** How long password login stays refused after too many failures. */
export const LOCKOUT_MINUTES = 15;

/**
 * Verifies credentials, enforces lockout policy, returns token pair + profile.
 * Never exposes which field was wrong — always "Invalid credentials". Lockout is
 * time-based (LOCKOUT_MINUTES) and indistinguishable from a wrong password, so
 * tripping it can't be used to confirm an account exists; OTP login bypasses and
 * clears it (the user proves email ownership instead).
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

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // Passwordless users (invited owners/staff awaiting OTP in 2C) cannot
  // sign in with a password.
  if (!user.passwordHash) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    // An expired lock means this failure starts a fresh count.
    const priorFails = user.lockedUntil && user.lockedUntil <= now ? 0 : user.failedLogins;
    const failedLogins = priorFails + 1;
    const lockedUntil =
      failedLogins >= env.AUTH_MAX_FAILED_LOGINS
        ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000)
        : null;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins, lockedUntil },
    });
    throw new UnauthorizedError('Invalid credentials');
  }

  // Suspended-tenant + active checks, login record, and token pair are shared
  // with the passwordless methods (only reached after valid credentials, so the
  // tenant's status is never leaked to wrong-password attempts).
  return finalizeSession(user);
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
    tenantName: user.tenant.name,
    onboardingCompletedAt: user.tenant.onboardingCompletedAt,
    fullName: user.fullName,
    email: user.email,
    role: user.role.name,
    permissions,
    hasPassword: user.passwordHash !== null,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

/**
 * Changes a user's password after verifying the current one. Passwordless
 * (invited) users may SET a first password without a current one — their
 * authenticated OTP session is the identity proof, and adding a password never
 * removes the OTP sign-in path.
 * Revokes all refresh tokens to force re-login on all devices.
 */
export async function changePassword(
  userId: string,
  currentPassword: string | undefined,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');

  if (user.passwordHash) {
    if (!currentPassword) throw new UnauthorizedError('Current password is incorrect');
    const valid = await verifyPassword(user.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedError('Current password is incorrect');
  }

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
