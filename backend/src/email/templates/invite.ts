import type { EmailMessage } from '../types';
import { renderLayout, escapeHtml, colors } from './layout';

export interface InviteTemplateInput {
  to: string;
  shopName: string;
  inviteUrl: string;
  /** 'owner' for a provisioned shop owner, 'staff' for a team invite. */
  kind: 'owner' | 'staff';
  expiresAt: Date;
}

/** Tenant/staff invite: a link to accept and set up sign-in. */
export function renderInviteEmail({
  to,
  shopName,
  inviteUrl,
  kind,
  expiresAt,
}: InviteTemplateInput): EmailMessage {
  const subject =
    kind === 'owner'
      ? `Set up ${shopName} on TyreStock`
      : `You've been invited to ${shopName} on TyreStock`;

  const lead =
    kind === 'owner'
      ? `Your shop <strong>${escapeHtml(shopName)}</strong> is ready. Accept your invite to set up sign-in and get started.`
      : `You've been invited to join <strong>${escapeHtml(shopName)}</strong> on TyreStock. Accept to set up your sign-in.`;

  const expires = expiresAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${colors.INK};">${kind === 'owner' ? 'Set up your shop' : 'Join the team'}</h1>
    <p style="margin:0 0 24px;color:${colors.MUTED};">${lead}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="border-radius:6px;background:${colors.AMBER};">
          <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#1c1205;text-decoration:none;">Accept invite</a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;color:${colors.MUTED};font-size:13px;">Or paste this link into your browser:</p>
    <p style="margin:0 0 20px;word-break:break-all;"><a href="${escapeHtml(inviteUrl)}" style="color:${colors.AMBER};font-size:13px;">${escapeHtml(inviteUrl)}</a></p>
    <p style="margin:0;color:${colors.MUTED};font-size:13px;">This invite expires on ${escapeHtml(expires)}.</p>
  `;

  const text = [
    kind === 'owner' ? `Set up ${shopName} on TyreStock` : `Join ${shopName} on TyreStock`,
    '',
    'Accept your invite:',
    inviteUrl,
    '',
    `This invite expires on ${expires}.`,
  ].join('\n');

  return {
    to,
    subject,
    html: renderLayout({ preheader: `Accept your invite to ${shopName}`, body }),
    text,
  };
}
