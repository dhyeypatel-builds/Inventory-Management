import { env } from '../config/env';
import { logger } from '../config/logger';
import type { EmailMessage, EmailTransport } from './types';
import { DevEmailTransport } from './transports/dev';
import { SmtpEmailTransport } from './transports/smtp';
import { renderOtpEmail, type OtpTemplateInput } from './templates/otp';
import { renderInviteEmail, type InviteTemplateInput } from './templates/invite';
import { renderWelcomeEmail, type WelcomeTemplateInput } from './templates/welcome';

let transport: EmailTransport | null = null;

/** Lazily build the transport selected by EMAIL_TRANSPORT (singleton). */
export function getTransport(): EmailTransport {
  if (!transport) {
    transport = env.EMAIL_TRANSPORT === 'smtp' ? new SmtpEmailTransport() : new DevEmailTransport();
  }
  return transport;
}

/** Test seam: swap the transport (e.g. a capturing fake). */
export function setTransport(next: EmailTransport | null): void {
  transport = next;
}

/**
 * Fail-soft send: a delivery failure is logged but never throws, so a flaky
 * mail provider can't roll back the business action that triggered the email
 * (provisioning, OTP issuance). Callers that must know decide via the return.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  try {
    await getTransport().send(message);
    return true;
  } catch (err) {
    logger.error({ err, to: message.to, subject: message.subject }, 'email send failed');
    return false;
  }
}

// ─── High-level helpers (render + send) ─────────────────────────────────────────

export const sendOtpEmail = (input: OtpTemplateInput): Promise<boolean> =>
  sendEmail(renderOtpEmail(input));

export const sendInviteEmail = (input: InviteTemplateInput): Promise<boolean> =>
  sendEmail(renderInviteEmail(input));

export const sendWelcomeEmail = (input: WelcomeTemplateInput): Promise<boolean> =>
  sendEmail(renderWelcomeEmail(input));

export type { EmailMessage, EmailTransport } from './types';
