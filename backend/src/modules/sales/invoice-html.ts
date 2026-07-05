import type { SaleInvoice } from './sales.service';
import type { ReportBranding } from '../reports/templates/report-html';
import { formatGbp } from '../reports/report-format';

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Net taxable amount and VAT charged, grouped by VAT rate (highest first). A UK
 * VAT invoice covering more than one rate must show this split per rate.
 */
export function taxBreakdown(
  items: { quantity: number; unitPrice: number; discount: number; taxRatePct: number; lineTotal: number }[],
): { rate: number; net: number; vat: number }[] {
  const byRate = new Map<number, { net: number; vat: number }>();
  for (const it of items) {
    const net = round2(it.unitPrice * it.quantity - it.discount);
    const vat = round2(it.lineTotal - net);
    const acc = byRate.get(it.taxRatePct) ?? { net: 0, vat: 0 };
    byRate.set(it.taxRatePct, { net: round2(acc.net + net), vat: round2(acc.vat + vat) });
  }
  return [...byRate.entries()]
    .map(([rate, v]) => ({ rate, net: v.net, vat: v.vat }))
    .sort((a, b) => b.rate - a.rate);
}

const C = {
  amber: '#E8820C',
  ink: '#1c1f24',
  muted: '#5b6470',
  border: '#e4e7ec',
  zebra: '#f7f8fa',
  head: '#1c1f24',
};

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: '#2f8a4e',
  RETURNED: '#b06a00',
  CANCELLED: '#c0392b',
  DRAFT: '#5b6470',
};

/** Renders a single sale's invoice into a print-ready, branded A4 HTML document. */
export function renderInvoiceHtml(invoice: SaleInvoice, branding: ReportBranding): string {
  const company = invoice.company as {
    address?: string;
    phone?: string;
  };

  const logo = branding.logoDataUri
    ? `<img class="logo" src="${branding.logoDataUri}" alt="" />`
    : `<div class="logo placeholder">${esc(branding.shopName.slice(0, 1).toUpperCase())}</div>`;

  // Billed-to: a walk-in shows the typed name (when given) above a "Walk-in
  // customer" label; otherwise the linked customer's details.
  const cust = invoice.customer;
  const billedToLines = invoice.isWalkIn
    ? [
        cust?.name ? `<div class="party-name">${esc(cust.name)}</div>` : '',
        `<div class="party-tag">Walk-in customer</div>`,
        cust?.email ? `<div class="party-line">${esc(cust.email)}</div>` : '',
      ]
    : [
        `<div class="party-name">${esc(cust?.name ?? 'Customer')}</div>`,
        cust?.phone ? `<div class="party-line">${esc(cust.phone)}</div>` : '',
        cust?.email ? `<div class="party-line">${esc(cust.email)}</div>` : '',
        cust?.address ? `<div class="party-line">${esc(cust.address)}</div>` : '',
        cust?.vatNumber ? `<div class="party-line">VAT ${esc(cust.vatNumber)}</div>` : '',
        cust?.vehicleNo ? `<div class="party-line">Vehicle ${esc(cust.vehicleNo)}</div>` : '',
      ];
  const billedTo = billedToLines.filter(Boolean).join('');

  // Unregistered shops must not present VAT: the document is a plain "INVOICE"
  // with no tax column or tax total.
  const vatRegistered = invoice.vatRegistered !== false;

  const rows = invoice.items
    .map(
      (it) => `<tr>
        <td>
          <div class="item-desc">${esc(it.description)}</div>
          ${it.sku ? `<div class="item-sku">${esc(it.sku)}</div>` : ''}
        </td>
        <td class="num">${it.quantity}</td>
        <td class="num">${formatGbp(it.unitPrice)}${
          it.listPrice != null && it.listPrice !== it.unitPrice
            ? `<div class="was">${formatGbp(it.listPrice)}</div>`
            : ''
        }</td>
        <td class="num">${it.discount > 0 ? formatGbp(it.discount) : '—'}</td>
        ${vatRegistered ? `<td class="num">${it.taxRatePct}%</td>` : ''}
        <td class="num strong">${formatGbp(it.lineTotal)}</td>
      </tr>`,
    )
    .join('');

  const soldAt = new Date(invoice.soldAt).toLocaleString('en-GB');
  const statusColor = STATUS_COLOR[invoice.status] ?? C.muted;

  // VAT lines: a single "Tax" row for one rate, or a per-rate breakdown when
  // the invoice mixes rates (UK VAT-invoice requirement). Omitted entirely when
  // the shop isn't VAT-registered.
  const breakdown = taxBreakdown(invoice.items);
  const taxRows = !vatRegistered
    ? ''
    : breakdown.length > 1
      ? breakdown
          .map(
            (b) =>
              `<div class="totals-row"><span>VAT ${b.rate}% on ${formatGbp(b.net)}</span><span>${formatGbp(b.vat)}</span></div>`,
          )
          .join('')
      : `<div class="totals-row"><span>Tax</span><span>${formatGbp(invoice.taxTotal)}</span></div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 portrait; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: ${C.ink}; font-size: 12px; line-height: 1.5;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .stripe { height: 4px; background: ${C.amber}; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding: 22px 0 16px; border-bottom: 1px solid ${C.border}; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo { width: 48px; height: 48px; border-radius: 6px; object-fit: cover; border: 1px solid ${C.border}; }
  .logo.placeholder { display: grid; place-items: center; background: ${C.ink}; color: #fff; font-weight: 800; font-size: 22px; }
  .shop-name { font-size: 17px; font-weight: 800; letter-spacing: -0.02em; }
  .shop-line { color: ${C.muted}; font-size: 11px; margin-top: 2px; }
  .meta { text-align: right; }
  .doc-title { font-size: 16px; font-weight: 800; letter-spacing: -0.01em; }
  .status { display: inline-block; margin-top: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: ${statusColor}; }
  .meta-line { color: ${C.muted}; font-size: 11px; margin-top: 3px; }
  .meta-line strong { color: ${C.ink}; font-weight: 700; }

  .parties { display: flex; justify-content: space-between; gap: 24px; margin: 18px 0 6px; }
  .party-label { color: ${C.muted}; font-size: 9px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-bottom: 4px; }
  .party-name { font-weight: 700; font-size: 13px; }
  .party-tag { color: ${C.muted}; font-size: 11px; font-style: italic; }
  .party-line { color: ${C.muted}; font-size: 11px; }

  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  thead { display: table-header-group; }
  th { background: ${C.head}; color: #fff; text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 10px; font-weight: 600; }
  th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td { padding: 8px 10px; border-bottom: 1px solid ${C.border}; vertical-align: top; }
  tbody tr:nth-child(even) { background: ${C.zebra}; }
  tr { break-inside: avoid; }
  .item-desc { font-weight: 600; }
  .item-sku { color: ${C.muted}; font-size: 10px; }
  .was { color: ${C.muted}; font-size: 9.5px; text-decoration: line-through; }
  td.strong { font-weight: 700; }

  .totals { margin-top: 18px; display: flex; justify-content: flex-end; }
  .totals-box { width: 260px; }
  .totals-row { display: flex; justify-content: space-between; color: ${C.muted}; padding: 3px 0; font-size: 12px; }
  .totals-grand { display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px solid ${C.ink}; margin-top: 6px; padding-top: 8px; }
  .totals-grand .label { font-weight: 700; font-size: 12px; }
  .totals-grand .value { font-weight: 800; font-size: 22px; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }

  .footer-note { margin-top: 26px; padding-top: 12px; border-top: 1px solid ${C.border}; color: ${C.muted}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; }
</style>
</head>
<body>
  <div class="stripe"></div>
  <header>
    <div class="brand">
      ${logo}
      <div>
        <div class="shop-name">${esc(branding.shopName)}</div>
        ${company.address ? `<div class="shop-line">${esc(company.address)}</div>` : ''}
        ${company.phone ? `<div class="shop-line">${esc(company.phone)}</div>` : ''}
        ${branding.vatNumber ? `<div class="shop-line">VAT ${esc(branding.vatNumber)}</div>` : ''}
      </div>
    </div>
    <div class="meta">
      <div class="doc-title">${vatRegistered ? 'TAX INVOICE' : 'INVOICE'}</div>
      <div class="status">${esc(invoice.status)}</div>
      <div class="meta-line">No <strong>${esc(invoice.invoiceNo)}</strong></div>
      <div class="meta-line">Date ${esc(soldAt)}</div>
      ${invoice.paymentMode ? `<div class="meta-line">Paid via ${esc(invoice.paymentMode)}</div>` : ''}
    </div>
  </header>

  <div class="parties">
    <div>
      <div class="party-label">Billed to</div>
      ${billedTo}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="num">Qty</th>
        <th class="num">Unit Price</th>
        <th class="num">Disc</th>
        ${vatRegistered ? '<th class="num">Tax%</th>' : ''}
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Subtotal</span><span>${formatGbp(invoice.subtotal)}</span></div>
      ${invoice.discount > 0 ? `<div class="totals-row"><span>Discount</span><span>−${formatGbp(invoice.discount)}</span></div>` : ''}
      ${taxRows}
      <div class="totals-grand"><span class="label">Grand Total</span><span class="value">${formatGbp(invoice.grandTotal)}</span></div>
    </div>
  </div>

  <div class="footer-note">Thank you for your business</div>
</body>
</html>`;
}

/** Chrome print footer: invoice number + page numbers. */
export const INVOICE_FOOTER_HTML = `
  <div style="width:100%; font-size:8px; color:#5b6470; padding:0 12mm; display:flex; justify-content:space-between;">
    <span>Generated by TyreStock</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`;
