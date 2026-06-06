export const REPORT_NAMES = [
  'sales',
  'fast-moving',
  'best-selling-brands',
  'low-stock',
  'stock-valuation',
  'tax',
] as const;

export type ReportName = (typeof REPORT_NAMES)[number];

export const REPORT_LABELS: Record<ReportName, string> = {
  sales: 'Sales Report',
  'fast-moving': 'Fast-Moving Items',
  'best-selling-brands': 'Best-Selling Brands',
  'low-stock': 'Low Stock',
  'stock-valuation': 'Stock Valuation',
  tax: 'Tax Report',
};

export interface ReportColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

export interface ReportResult {
  name: ReportName;
  title: string;
  range: { from: string | null; to: string | null };
  generatedAt: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  summary?: Record<string, number>;
}

export interface ReportQuery {
  from?: string;
  to?: string;
  limit?: number;
}
