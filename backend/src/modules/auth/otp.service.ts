import { randomInt } from 'crypto';
import { prisma } from '../../db/prisma';
import { ValidationError } from '../../utils/errors';
import { sendOtpEmail } from '../../email';
import { hashPassword, verifyPassword, finalizeSession, type LoginResult } from './auth.service';
import { loadUserForLogin } from './auth.service';

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

/** Six-digit numeric code, zero-padded. */
function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Issues an OTP for `email` if it belongs to an active, non-suspended account.
 * Always resolves the same way to the caller (the controller returns a generic
 * 200) so an attacker can't enumerate which emails have accounts.
 */
export async function requestOtp(email: string): Promise<void> {
  const user = await loadUserForLogin(email);
  if (!user || !user.isActive || user.tenant.status === 'SUSPENDED') {
    return; // No account / not eligible — issue nothing, reveal nothing.
  }

  const code = generateCode();
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

  // Supersede any earlier unconsumed codes for this email.
  await prisma.otpCode.deleteMany({ where: { email, consumedAt: null } });
  await prisma.otpCode.create({ data: { email, codeHash, expiresAt } });

  await sendOtpEmail({ to: email, code, ttlMinutes: CODE_TTL_MINUTES });
}

/**
 * Verifies an OTP and, on success, issues a session. Generic 400 on any failure
 * (missing/expired/wrong/locked) so failures aren't distinguishable.
 */
export async function verifyOtp(email: string, code: string): Promise<LoginResult> {
  const otp = await prisma.otpCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  const invalid = (): never => {
    throw new ValidationError('Invalid or expired code');
  };

  if (!otp || otp.expiresAt < new Date()) invalid();
  if (otp!.attempts >= MAX_ATTEMPTS) invalid();

  const ok = await verifyPassword(otp!.codeHash, code);
  if (!ok) {
    await prisma.otpCode.update({ where: { id: otp!.id }, data: { attempts: { increment: 1 } } });
    invalid();
  }

  await prisma.otpCode.update({ where: { id: otp!.id }, data: { consumedAt: new Date() } });

  const user = await loadUserForLogin(email);
  if (!user) invalid();
  return finalizeSession(user!);
}
