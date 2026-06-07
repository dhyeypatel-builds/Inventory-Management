import type { ReportResult } from './reports.service';

/**
 * Money columns across the six reports, by key. Centralised so both the XLSX and
 * PDF renderers format £ consistently without each report def repeating a flag.
 */
export const CURRENCY_KEYS = new Set([
  'subtotal',
  'discount',
  'taxTotal',
  'grandTotal',
  'revenue',
  'totalValue',
  'taxableAmount',
  'taxAmount',
]);

/** Summary keys that hold money (the rest are counts). */
export const CURRENCY_SUMMARY_KEYS = new Set([
  'totalRevenue',
  'totalDiscount',
  'totalTax',
  'totalSubtotal',
  'grandTotal',
  'totalValue',
  'totalTaxCollected',
  'totalTaxableAmount',
]);

export const isCurrencyKey = (key: string): boolean => CURRENCY_KEYS.has(key);

/** Human label for a summary key, e.g. `totalRevenue` → `Total revenue`. */
export const humanizeSummaryKey = (key: string): string =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

export const formatGbp = (n: number): string =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

export const formatNumber = (n: number): string =>
  n.toLocaleString('en-GB', { maximumFractionDigits: 2 });

/** Period label for a report header. */
export const periodLabel = (report: ReportResult): string =>
  report.range.from || report.range.to
    ? `${report.range.from ?? 'start'} → ${report.range.to ?? 'today'}`
    : 'All time';
