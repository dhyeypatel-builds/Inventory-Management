import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { currentTenant } from '../../tenancy/context';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { sendInviteEmail } from '../../email';
import type { InviteStaffInput } from './team.schema';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  roleName: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  pending: boolean; // invited but not yet signed in
}

export interface PendingInvite {
  id: string;
  email: string;
  roleName: string;
  expiresAt: Date;
  createdAt: Date;
}

/** Members + outstanding invites for the current tenant. */
export async function listTeam(): Promise<{ members: TeamMember[]; invites: PendingInvite[] }> {
  const [users, invites] = await Promise.all([
    prisma.user.findMany({ include: { role: true }, orderBy: { createdAt: 'asc' } }),
    prisma.invite.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    members: users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      roleName: u.role.name,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      pending: u.lastLoginAt === null,
    })),
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      roleName: i.role.name,
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
    })),
  };
}

/**
 * Invites a staff member to the current tenant: creates a passwordless user with
 * the chosen role + an invite, and emails the accept link. The new user can sign
 * in via OTP/Google immediately; the invite link just guides first-time setup.
 */
export async function inviteStaff(
  input: InviteStaffInput,
  invitedBy: string,
): Promise<PendingInvite> {
  const tenantId = currentTenant();
  const role = await prisma.role.findFirst({ where: { name: input.roleName } });
  if (!role) throw new NotFoundError('Role');

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  let invite;
  try {
    invite = await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          tenantId,
          email: input.email,
          fullName: input.fullName,
          passwordHash: null,
          roleId: role.id,
        },
      });
      return tx.invite.create({
        data: { tenantId, email: input.email, roleId: role.id, token, expiresAt, invitedBy },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('That email already has an account');
    }
    throw err;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  await sendInviteEmail({
    to: input.email,
    shopName: tenant?.name ?? 'your shop',
    inviteUrl: `${env.APP_URL}/invite/${token}`,
    kind: 'staff',
    expiresAt,
  });

  return {
    id: invite.id,
    email: invite.email,
    roleName: role.name,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  };
}

/**
 * Revokes a pending invite (and removes the not-yet-used account it created).
 * An already-accepted invite cannot be revoked.
 */
export async function revokeInvite(id: string): Promise<void> {
  const invite = await prisma.invite.findFirst({ where: { id } });
  if (!invite) throw new NotFoundError('Invite');
  if (invite.acceptedAt) throw new ConflictError('That invite has already been accepted');

  await prisma.$transaction(async (tx) => {
    await tx.invite.deleteMany({ where: { id } });
    // Remove the passwordless account if it never signed in.
    await tx.user.deleteMany({ where: { email: invite.email, lastLoginAt: null } });
  });
}
