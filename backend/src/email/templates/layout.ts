/**
 * Shared responsive HTML shell for transactional email. Inline styles only —
 * email clients strip <style> and external CSS. Light Industrial palette:
 * steel neutrals + hazard amber, matching the app.
 */
const AMBER = '#E8820C';
const INK = '#1c1f24';
const MUTED = '#5b6470';
const BORDER = '#e4e7ec';
const BG = '#f4f5f7';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface LayoutInput {
  /** Preheader: the grey preview line shown in the inbox list. */
  preheader: string;
  /** Inner content HTML (already escaped where needed). */
  body: string;
}

export function renderLayout({ preheader, body }: LayoutInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>TyreStock</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:480px;background:#ffffff;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="height:3px;background:${AMBER};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:28px 32px 8px;">
            <span style="font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${AMBER};font-family:'JetBrains Mono',monospace;">TyreStock</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 32px;color:${INK};font-size:15px;line-height:1.6;">
            ${body}
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr>
          <td style="padding:20px 32px;color:${MUTED};font-size:12px;line-height:1.5;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            TyreStock — workshop inventory &amp; point of sale.<br>
            If you weren't expecting this email, you can safely ignore it.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export const colors = { AMBER, INK, MUTED, BORDER, BG };
