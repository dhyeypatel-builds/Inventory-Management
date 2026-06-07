import type { EmailMessage } from '../types';
import { renderLayout, escapeHtml, colors } from './layout';

export interface WelcomeTemplateInput {
  to: string;
  shopName: string;
  appUrl: string;
}

/** Post-onboarding welcome. */
export function renderWelcomeEmail({ to, shopName, appUrl }: WelcomeTemplateInput): EmailMessage {
  const subject = `${shopName} is live on TyreStock`;

  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${colors.INK};">You're all set</h1>
    <p style="margin:0 0 24px;color:${colors.MUTED};"><strong>${escapeHtml(shopName)}</strong> is set up and ready. Track stock, ring up sales, and catch low-stock before the shelf is empty.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      <tr>
        <td style="border-radius:6px;background:${colors.AMBER};">
          <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#1c1205;text-decoration:none;">Open TyreStock</a>
        </td>
      </tr>
    </table>
  `;

  const text = [
    `${shopName} is live on TyreStock`,
    '',
    "You're all set. Open TyreStock to get started:",
    appUrl,
  ].join('\n');

  return {
    to,
    subject,
    html: renderLayout({ preheader: `${shopName} is ready to go`, body }),
    text,
  };
}
