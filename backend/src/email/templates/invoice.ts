import type { EmailMessage } from '../types';
import { renderLayout, escapeHtml, colors } from './layout';

export interface InvoiceTemplateInput {
  to: string;
  invoiceNo: string;
  shopName: string;
  grandTotal: number;
  /** Shop contact address replies should be routed to (optional). */
  replyTo?: string;
  /** The rendered invoice PDF, attached to the email. */
  pdf: Buffer;
}

const gbp = (n: number): string =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

/** Invoice email: a short note with the branded invoice PDF attached. */
export function renderInvoiceEmail({
  to,
  invoiceNo,
  shopName,
  grandTotal,
  replyTo,
  pdf,
}: InvoiceTemplateInput): EmailMessage {
  const subject = `Invoice ${invoiceNo} from ${shopName}`;

  // Email clients (notably Gmail) strip flexbox, which collapses label/value
  // pairs together — so the summary is laid out with a presentation table.
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${colors.INK};">Your invoice</h1>
    <p style="margin:0 0 20px;color:${colors.MUTED};">Thanks for your business. Your invoice from ${escapeHtml(shopName)} is attached as a PDF.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:${colors.BG};border:1px solid ${colors.BORDER};border-radius:8px;">
      <tr>
        <td style="padding:16px 18px 8px;color:${colors.MUTED};font-size:13px;">Invoice</td>
        <td style="padding:16px 18px 8px;color:${colors.INK};font-size:13px;font-weight:600;font-family:'JetBrains Mono',monospace;text-align:right;">${escapeHtml(invoiceNo)}</td>
      </tr>
      <tr>
        <td style="padding:0 18px 16px;color:${colors.MUTED};font-size:13px;">Total</td>
        <td style="padding:0 18px 16px;color:${colors.INK};font-size:16px;font-weight:800;text-align:right;">${escapeHtml(gbp(grandTotal))}</td>
      </tr>
    </table>
    ${
      replyTo
        ? `<p style="margin:0;color:${colors.MUTED};font-size:13px;">Questions about this invoice? Just reply to this email.</p>`
        : ''
    }
  `;

  const text = [
    `Your invoice from ${shopName}`,
    '',
    `Invoice: ${invoiceNo}`,
    `Total: ${gbp(grandTotal)}`,
    '',
    `Your invoice is attached as a PDF.${replyTo ? ' Questions? Reply to this email.' : ''}`,
  ].join('\n');

  return {
    to,
    subject,
    replyTo,
    html: renderLayout({ preheader: `Invoice ${invoiceNo} · ${gbp(grandTotal)}`, body }),
    text,
    attachments: [
      { filename: `${invoiceNo}.pdf`, content: pdf, contentType: 'application/pdf' },
    ],
  };
}
