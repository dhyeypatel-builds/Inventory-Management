import type { EmailMessage } from '../types';
import { renderLayout, escapeHtml, colors } from './layout';

export interface OtpTemplateInput {
  to: string;
  code: string;
  ttlMinutes: number;
}

/** Email OTP: a 6-digit sign-in code. */
export function renderOtpEmail({ to, code, ttlMinutes }: OtpTemplateInput): EmailMessage {
  const subject = `${code} is your TyreStock sign-in code`;

  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${colors.INK};">Your sign-in code</h1>
    <p style="margin:0 0 20px;color:${colors.MUTED};">Enter this code to finish signing in. It expires in ${ttlMinutes} minutes.</p>
    <div style="margin:0 0 20px;padding:18px;background:${colors.BG};border:1px solid ${colors.BORDER};border-radius:8px;text-align:center;">
      <span style="font-family:'JetBrains Mono',monospace;font-size:34px;font-weight:700;letter-spacing:0.32em;color:${colors.INK};">${escapeHtml(code)}</span>
    </div>
    <p style="margin:0;color:${colors.MUTED};font-size:13px;">Didn't try to sign in? Ignore this email — your account is safe and no one can sign in without the code.</p>
  `;

  const text = [
    'Your TyreStock sign-in code',
    '',
    `Code: ${code}`,
    `This code expires in ${ttlMinutes} minutes.`,
    '',
    "Didn't try to sign in? You can safely ignore this email.",
  ].join('\n');

  return { to, subject, html: renderLayout({ preheader: `Your code is ${code}`, body }), text };
}
