import type { ReportResult } from '../reports.service';
import {
  isCurrencyKey,
  formatGbp,
  formatNumber,
  humanizeSummaryKey,
  CURRENCY_SUMMARY_KEYS,
  periodLabel,
} from '../report-format';
import { chartBlock } from './chart';

export interface ReportBranding {
  shopName: string;
  vatNumber?: string;
  /** data: URI of the logo (read from storage, inlined), or null. */
  logoDataUri?: string | null;
}

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const cell = (value: unknown, key: string, numeric?: boolean): string => {
  if (value === null || value === undefined || value === '') return '';
  if (numeric && typeof value === 'number') {
    return isCurrencyKey(key) ? formatGbp(value) : formatNumber(value);
  }
  return esc(value);
};

const C = {
  amber: '#E8820C',
  ink: '#1c1f24',
  muted: '#5b6470',
  border: '#e4e7ec',
  zebra: '#f7f8fa',
  head: '#1c1f24',
};

/** Renders a ReportResult into a print-ready, branded HTML document. */
export function renderReportHtml(report: ReportResult, branding: ReportBranding): string {
  const cols = report.columns;

  const headCells = cols
    .map((c) => `<th class="${c.numeric ? 'num' : ''}">${esc(c.label)}</th>`)
    .join('');

  const bodyRows = report.rows.length
    ? report.rows
        .map(
          (row) =>
            `<tr>${cols
              .map((c) => `<td class="${c.numeric ? 'num' : ''}">${cell(row[c.key], c.key, c.numeric)}</td>`)
              .join('')}</tr>`,
        )
        .join('')
    : `<tr class="empty"><td colspan="${cols.length}">No data for the selected period.</td></tr>`;

  const summary = report.summary && Object.keys(report.summary).length
    ? `<section class="summary">
        ${Object.entries(report.summary)
          .map(
            ([k, v]) => `<div class="metric">
              <div class="metric-label">${esc(humanizeSummaryKey(k))}</div>
              <div class="metric-value">${CURRENCY_SUMMARY_KEYS.has(k) ? formatGbp(v) : formatNumber(v)}</div>
            </div>`,
          )
          .join('')}
      </section>`
    : '';

  const logo = branding.logoDataUri
    ? `<img class="logo" src="${branding.logoDataUri}" alt="" />`
    : `<div class="logo placeholder">${esc(branding.shopName.slice(0, 1).toUpperCase())}</div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 landscape; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: ${C.ink}; font-size: 11px; line-height: 1.45;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .stripe { height: 4px; background: ${C.amber}; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding: 18px 0 14px; border-bottom: 1px solid ${C.border}; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo { width: 44px; height: 44px; border-radius: 6px; object-fit: cover; border: 1px solid ${C.border}; }
  .logo.placeholder { display: grid; place-items: center; background: ${C.ink}; color: #fff; font-weight: 800; font-size: 20px; }
  .shop-name { font-size: 16px; font-weight: 800; letter-spacing: -0.02em; }
  .vat { color: ${C.muted}; font-size: 10px; margin-top: 2px; }
  .meta { text-align: right; }
  .report-title { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
  .meta-line { color: ${C.muted}; font-size: 10px; margin-top: 3px; }
  .meta-line strong { color: ${C.ink}; font-weight: 600; }

  .summary { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0; }
  .metric { border: 1px solid ${C.border}; border-radius: 6px; padding: 9px 14px; min-width: 130px; }
  .metric-label { color: ${C.muted}; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
  .metric-value { font-size: 17px; font-weight: 800; letter-spacing: -0.02em; margin-top: 3px; font-variant-numeric: tabular-nums; }

  .chart-wrap { margin: 16px 0 4px; padding: 12px; border: 1px solid ${C.border}; border-radius: 6px; break-inside: avoid; }
  .chart-wrap canvas { width: 100% !important; height: auto !important; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  thead { display: table-header-group; }
  th { background: ${C.head}; color: #fff; text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; padding: 7px 9px; font-weight: 600; }
  th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td { padding: 6px 9px; border-bottom: 1px solid ${C.border}; }
  tbody tr:nth-child(even) { background: ${C.zebra}; }
  tr { break-inside: avoid; }
  .empty td { text-align: center; color: ${C.muted}; padding: 22px; font-style: italic; }
</style>
</head>
<body>
  <div class="stripe"></div>
  <header>
    <div class="brand">
      ${logo}
      <div>
        <div class="shop-name">${esc(branding.shopName)}</div>
        ${branding.vatNumber ? `<div class="vat">VAT ${esc(branding.vatNumber)}</div>` : ''}
      </div>
    </div>
    <div class="meta">
      <div class="report-title">${esc(report.title)}</div>
      <div class="meta-line">Period: <strong>${esc(periodLabel(report))}</strong></div>
      <div class="meta-line">Generated ${esc(new Date(report.generatedAt).toLocaleString('en-GB'))}</div>
    </div>
  </header>
  ${summary}
  ${chartBlock(report)}
  <table>
    <thead><tr>${headCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
}

/** Chrome print footer: page numbers + attribution. */
export const REPORT_FOOTER_HTML = `
  <div style="width:100%; font-size:8px; color:#5b6470; padding:0 12mm; display:flex; justify-content:space-between;">
    <span>Generated by TyreStock</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`;
