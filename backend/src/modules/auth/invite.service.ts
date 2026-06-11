import { prisma } from '../../db/prisma';
import { AppError, NotFoundError } from '../../utils/errors';
import { sha256Hex } from '../../utils/hash';

export interface InviteDetails {
  email: string;
  tenantName: string;
  roleName: string;
  expiresAt: Date;
}

/**
 * Validates an invite token for the accept page. The invited user already exists
 * (passwordless), so "accepting" is simply proving email ownership via OTP or
 * Google — which marks the invite accepted in finalizeSession. This endpoint
 * just surfaces who/what the invite is for.
 */
export async function getInviteByToken(token: string): Promise<InviteDetails> {
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { tenant: true, role: true },
  });

  if (!invite) throw new NotFoundError('Invite');
  if (invite.acceptedAt) throw new AppError(410, 'INVITE_USED', 'This invite has already been used');
  if (invite.expiresAt < new Date()) {
    throw new AppError(410, 'INVITE_EXPIRED', 'This invite has expired');
  }

  return {
    email: invite.email,
    tenantName: invite.tenant.name,
    roleName: invite.role.name,
    expiresAt: invite.expiresAt,
  };
}
