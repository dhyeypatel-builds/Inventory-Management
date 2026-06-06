import { prisma } from '../../db/prisma';
import { currentTenant } from '../../tenancy/context';
import { ValidationError } from '../../utils/errors';

// ─── Types ───────────────────────────────────────────────────────────────────

export const REPORT_NAMES = [
  'sales',
  'fast-moving',
  'best-selling-brands',
  'low-stock',
  'stock-valuation',
  'tax',
] as const;
export type ReportName = (typeof REPORT_NAMES)[number];

export interface ReportQuery {
  from?: string;
  to?: string;
  limit?: number;
}

interface ReportColumn {
  key: string;
  label: string;
  /** Numeric columns are right-aligned in the PDF and summed where relevant. */
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

// ─── Date-range helpers ───────────────────────────────────────────────────────

const EPOCH = new Date('1970-01-01T00:00:00.000Z');
const FAR_FUTURE = new Date('9999-12-31T23:59:59.999Z');
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseFrom(value?: string): Date {
  if (!value) return EPOCH;
  const d = new Date(DATE_ONLY.test(value) ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(d.getTime())) throw new ValidationError('Invalid "from" date');
  return d;
}

function parseTo(value?: string): Date {
  if (!value) return FAR_FUTURE;
  // A date-only "to" is treated as inclusive of the whole day.
  const d = new Date(DATE_ONLY.test(value) ? `${value}T23:59:59.999Z` : value);
  if (Number.isNaN(d.getTime())) throw new ValidationError('Invalid "to" date');
  return d;
}

const num = (v: string | null): number => (v === null ? 0 : parseFloat(v));

// ─── Individual reports ────────────────────────────────────────────────────────

async function salesReport(q: ReportQuery): Promise<ReportResult> {
  const tenantId = currentTenant();
  const from = parseFrom(q.from);
  const to = parseTo(q.to);
  const limit = q.limit ?? 1000;

  const rows = await prisma.$queryRaw<
    {
      invoice_no: string;
      sold_at: Date;
      customer_name: string | null;
      item_count: number;
      subtotal: string;
      discount: string;
      tax_total: string;
      grand_total: string;
      payment_mode: string | null;
    }[]
  >`
    SELECT s.invoice_no,
           s.sold_at,
           c.name AS customer_name,
           COUNT(si.id)::int        AS item_count,
           s.subtotal::text         AS subtotal,
           s.discount::text         AS discount,
           s.tax_total::text        AS tax_total,
           s.grand_total::text      AS grand_total,
           s.payment_mode
    FROM sales s
    LEFT JOIN customers c   ON s.customer_id = c.id
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE s.tenant_id = ${tenantId}
      AND s.status = 'CONFIRMED' AND s.sold_at >= ${from} AND s.sold_at <= ${to}
    GROUP BY s.id, c.name
    ORDER BY s.sold_at DESC
    LIMIT ${limit}
  `;

  const [totals] = await prisma.$queryRaw<
    { sales_count: number; subtotal: string; discount: string; tax_total: string; grand_total: string }[]
  >`
    SELECT COUNT(*)::int          AS sales_count,
           COALESCE(SUM(subtotal), 0)::text     AS subtotal,
           COALESCE(SUM(discount), 0)::text     AS discount,
           COALESCE(SUM(tax_total), 0)::text    AS tax_total,
           COALESCE(SUM(grand_total), 0)::text  AS grand_total
    FROM sales
    WHERE tenant_id = ${tenantId}
      AND status = 'CONFIRMED' AND sold_at >= ${from} AND sold_at <= ${to}
  `;

  return {
    name: 'sales',
    title: 'Sales Report',
    range: { from: q.from ?? null, to: q.to ?? null },
    generatedAt: new Date().toISOString(),
    columns: [
      { key: 'invoiceNo', label: 'Invoice No' },
      { key: 'soldAt', label: 'Date' },
      { key: 'customerName', label: 'Customer' },
      { key: 'itemCount', label: 'Items', numeric: true },
      { key: 'subtotal', label: 'Subtotal', numeric: true },
      { key: 'discount', label: 'Discount', numeric: true },
      { key: 'taxTotal', label: 'Tax', numeric: true },
      { key: 'grandTotal', label: 'Grand Total', numeric: true },
      { key: 'paymentMode', label: 'Payment' },
    ],
    rows: rows.map((r) => ({
      invoiceNo: r.invoice_no,
      soldAt: r.sold_at.toISOString(),
      customerName: r.customer_name ?? '(Walk-in)',
      itemCount: r.item_count,
      subtotal: num(r.subtotal),
      discount: num(r.discount),
      taxTotal: num(r.tax_total),
      grandTotal: num(r.grand_total),
      paymentMode: r.payment_mode ?? '',
    })),
    summary: {
      salesCount: totals.sales_count,
      subtotal: num(totals.subtotal),
      discount: num(totals.discount),
      taxTotal: num(totals.tax_total),
      grandTotal: num(totals.grand_total),
    },
  };
}

async function fastMovingReport(q: ReportQuery): Promise<ReportResult> {
  const tenantId = currentTenant();
  const from = parseFrom(q.from);
  const to = parseTo(q.to);
  const limit = q.limit ?? 50;

  const rows = await prisma.$queryRaw<
    { sku: string; product_name: string; brand_name: string | null; units: number; revenue: string }[]
  >`
    SELECT pv.sku,
           p.name AS product_name,
           b.name AS brand_name,
           SUM(si.quantity)::int   AS units,
           SUM(si.line_total)::text AS revenue
    FROM sale_items si
    JOIN sales s             ON si.sale_id = s.id
      AND s.status = 'CONFIRMED' AND s.sold_at >= ${from} AND s.sold_at <= ${to}
    JOIN product_variants pv ON si.variant_id = pv.id
    JOIN products p          ON pv.product_id = p.id
    LEFT JOIN brands b       ON p.brand_id = b.id
    WHERE si.tenant_id = ${tenantId}
    GROUP BY pv.id, pv.sku, p.name, b.name
    ORDER BY SUM(si.quantity) DESC
    LIMIT ${limit}
  `;

  return {
    name: 'fast-moving',
    title: 'Fast-Moving Products',
    range: { from: q.from ?? null, to: q.to ?? null },
    generatedAt: new Date().toISOString(),
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'productName', label: 'Product' },
      { key: 'brandName', label: 'Brand' },
      { key: 'units', label: 'Units Sold', numeric: true },
      { key: 'revenue', label: 'Revenue', numeric: true },
    ],
    rows: rows.map((r) => ({
      sku: r.sku,
      productName: r.product_name,
      brandName: r.brand_name ?? '(No brand)',
      units: r.units,
      revenue: num(r.revenue),
    })),
    summary: {
      totalUnits: rows.reduce((acc, r) => acc + r.units, 0),
      totalRevenue: rows.reduce((acc, r) => acc + num(r.revenue), 0),
    },
  };
}

async function bestSellingBrandsReport(q: ReportQuery): Promise<ReportResult> {
  const tenantId = currentTenant();
  const from = parseFrom(q.from);
  const to = parseTo(q.to);
  const limit = q.limit ?? 50;

  const rows = await prisma.$queryRaw<
    { brand_name: string | null; units: number; revenue: string }[]
  >`
    SELECT b.name AS brand_name,
           SUM(si.quantity)::int    AS units,
           SUM(si.line_total)::text AS revenue
    FROM sale_items si
    JOIN sales s             ON si.sale_id = s.id
      AND s.status = 'CONFIRMED' AND s.sold_at >= ${from} AND s.sold_at <= ${to}
    JOIN product_variants pv ON si.variant_id = pv.id
    JOIN products p          ON pv.product_id = p.id
    LEFT JOIN brands b       ON p.brand_id = b.id
    WHERE si.tenant_id = ${tenantId}
    GROUP BY b.id, b.name
    ORDER BY SUM(si.line_total) DESC NULLS LAST
    LIMIT ${limit}
  `;

  return {
    name: 'best-selling-brands',
    title: 'Best-Selling Brands',
    range: { from: q.from ?? null, to: q.to ?? null },
    generatedAt: new Date().toISOString(),
    columns: [
      { key: 'brandName', label: 'Brand' },
      { key: 'units', label: 'Units Sold', numeric: true },
      { key: 'revenue', label: 'Revenue', numeric: true },
    ],
    rows: rows.map((r) => ({
      brandName: r.brand_name ?? '(No brand)',
      units: r.units,
      revenue: num(r.revenue),
    })),
    summary: {
      totalUnits: rows.reduce((acc, r) => acc + r.units, 0),
      totalRevenue: rows.reduce((acc, r) => acc + num(r.revenue), 0),
    },
  };
}

async function lowStockReport(): Promise<ReportResult> {
  const tenantId = currentTenant();
  const rows = await prisma.$queryRaw<
    {
      sku: string;
      product_name: string;
      brand_name: string | null;
      on_hand: number;
      reorder_level: number;
      rack_location: string | null;
    }[]
  >`
    SELECT pv.sku,
           p.name AS product_name,
           b.name AS brand_name,
           i.quantity      AS on_hand,
           i.reorder_level AS reorder_level,
           i.rack_location AS rack_location
    FROM inventory i
    JOIN product_variants pv ON i.variant_id = pv.id
    JOIN products p          ON pv.product_id = p.id
    LEFT JOIN brands b       ON p.brand_id = b.id
    WHERE i.tenant_id = ${tenantId}
      AND pv.deleted_at IS NULL AND pv.is_active = true
      AND p.deleted_at  IS NULL AND p.is_active  = true
      AND i.quantity <= i.reorder_level
    ORDER BY i.quantity ASC
  `;

  return {
    name: 'low-stock',
    title: 'Low-Stock Report',
    range: { from: null, to: null },
    generatedAt: new Date().toISOString(),
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'productName', label: 'Product' },
      { key: 'brandName', label: 'Brand' },
      { key: 'onHand', label: 'On Hand', numeric: true },
      { key: 'reorderLevel', label: 'Reorder Level', numeric: true },
      { key: 'rackLocation', label: 'Rack' },
    ],
    rows: rows.map((r) => ({
      sku: r.sku,
      productName: r.product_name,
      brandName: r.brand_name ?? '(No brand)',
      onHand: r.on_hand,
      reorderLevel: r.reorder_level,
      rackLocation: r.rack_location ?? '',
    })),
    summary: { itemsBelowReorder: rows.length },
  };
}

async function stockValuationReport(): Promise<ReportResult> {
  const tenantId = currentTenant();
  const rows = await prisma.$queryRaw<
    { brand_name: string | null; total_qty: number; total_value: string }[]
  >`
    SELECT b.name AS brand_name,
           SUM(i.quantity)::int                      AS total_qty,
           SUM(i.quantity * pv.purchase_price)::text AS total_value
    FROM inventory i
    JOIN product_variants pv ON i.variant_id = pv.id
    JOIN products p          ON pv.product_id = p.id
    LEFT JOIN brands b       ON p.brand_id = b.id
    WHERE i.tenant_id = ${tenantId}
      AND pv.deleted_at IS NULL AND pv.is_active = true
      AND p.deleted_at  IS NULL AND p.is_active  = true
    GROUP BY b.id, b.name
    ORDER BY SUM(i.quantity * pv.purchase_price) DESC NULLS LAST
  `;

  return {
    name: 'stock-valuation',
    title: 'Stock Valuation',
    range: { from: null, to: null },
    generatedAt: new Date().toISOString(),
    columns: [
      { key: 'brandName', label: 'Brand' },
      { key: 'totalQty', label: 'Total Qty', numeric: true },
      { key: 'totalValue', label: 'Stock Value', numeric: true },
    ],
    rows: rows.map((r) => ({
      brandName: r.brand_name ?? '(No brand)',
      totalQty: r.total_qty,
      totalValue: num(r.total_value),
    })),
    summary: {
      totalQty: rows.reduce((acc, r) => acc + r.total_qty, 0),
      totalValue: rows.reduce((acc, r) => acc + num(r.total_value), 0),
    },
  };
}

async function taxReport(q: ReportQuery): Promise<ReportResult> {
  const tenantId = currentTenant();
  const from = parseFrom(q.from);
  const to = parseTo(q.to);

  const rows = await prisma.$queryRaw<
    { tax_rate_pct: string; taxable_amount: string; tax_amount: string }[]
  >`
    SELECT si.tax_rate_pct::text AS tax_rate_pct,
           SUM((si.unit_price * si.quantity) - si.discount)::text                          AS taxable_amount,
           SUM(((si.unit_price * si.quantity) - si.discount) * si.tax_rate_pct / 100)::text AS tax_amount
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
      AND s.status = 'CONFIRMED' AND s.sold_at >= ${from} AND s.sold_at <= ${to}
    WHERE si.tenant_id = ${tenantId}
    GROUP BY si.tax_rate_pct
    ORDER BY si.tax_rate_pct
  `;

  return {
    name: 'tax',
    title: 'Tax Report',
    range: { from: q.from ?? null, to: q.to ?? null },
    generatedAt: new Date().toISOString(),
    columns: [
      { key: 'taxRatePct', label: 'Tax Rate %', numeric: true },
      { key: 'taxableAmount', label: 'Taxable Amount', numeric: true },
      { key: 'taxAmount', label: 'Tax Collected', numeric: true },
    ],
    rows: rows.map((r) => ({
      taxRatePct: num(r.tax_rate_pct),
      taxableAmount: num(r.taxable_amount),
      taxAmount: num(r.tax_amount),
    })),
    summary: {
      totalTaxable: rows.reduce((acc, r) => acc + num(r.taxable_amount), 0),
      totalTax: rows.reduce((acc, r) => acc + num(r.tax_amount), 0),
    },
  };
}

// ─── Dispatch ──────────────────────────────────────────────────────────────────

export async function generateReport(name: ReportName, query: ReportQuery): Promise<ReportResult> {
  switch (name) {
    case 'sales':
      return salesReport(query);
    case 'fast-moving':
      return fastMovingReport(query);
    case 'best-selling-brands':
      return bestSellingBrandsReport(query);
    case 'low-stock':
      return lowStockReport();
    case 'stock-valuation':
      return stockValuationReport();
    case 'tax':
      return taxReport(query);
    default:
      throw new ValidationError(`Unknown report "${name as string}"`);
  }
}

// ─── CSV export ────────────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  // Quote when the cell contains a delimiter, quote, or newline.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToCsv(report: ReportResult): string {
  const header = report.columns.map((c) => csvCell(c.label)).join(',');
  const body = report.rows.map((row) =>
    report.columns.map((c) => csvCell(row[c.key])).join(','),
  );
  return [header, ...body].join('\r\n');
}

// ─── PDF export ──────────────────────────────────────────────────────────────

const fmtCell = (value: unknown, numeric?: boolean): string => {
  if (value === null || value === undefined || value === '') return '';
  if (numeric && typeof value === 'number') {
    return value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  }
  return String(value);
};

/**
 * Render a report's table into an existing PDFKit document. The caller owns the
 * document lifecycle (piping to the response and calling `.end()`).
 */
export function writeReportToPdf(doc: PDFKit.PDFDocument, report: ReportResult): void {
  const left = doc.page.margins.left;
  const usableWidth = doc.page.width - left - doc.page.margins.right;
  const colWidth = usableWidth / report.columns.length;

  doc.fontSize(18).text(report.title, { align: 'left' });
  doc.moveDown(0.3);

  doc.fontSize(9).fillColor('#555');
  const rangeText =
    report.range.from || report.range.to
      ? `Period: ${report.range.from ?? 'start'} → ${report.range.to ?? 'now'}`
      : 'Period: all time';
  doc.text(rangeText);
  doc.text(`Generated: ${report.generatedAt}`);
  doc.fillColor('#000');
  doc.moveDown(0.6);

  const rowHeight = 18;

  const drawRow = (cells: string[], opts: { bold?: boolean } = {}): void => {
    // Page break if we're near the bottom.
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
    const y = doc.y;
    doc.fontSize(9).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica');
    report.columns.forEach((col, i) => {
      doc.text(cells[i] ?? '', left + i * colWidth + 2, y + 4, {
        width: colWidth - 4,
        align: col.numeric ? 'right' : 'left',
        lineBreak: false,
      });
    });
    doc
      .moveTo(left, y + rowHeight)
      .lineTo(left + usableWidth, y + rowHeight)
      .strokeColor('#e0e0e0')
      .stroke()
      .strokeColor('#000');
    doc.y = y + rowHeight;
  };

  drawRow(
    report.columns.map((c) => c.label),
    { bold: true },
  );

  if (report.rows.length === 0) {
    doc.moveDown(0.5).fontSize(10).fillColor('#777').text('No data for the selected period.');
    doc.fillColor('#000');
  } else {
    for (const row of report.rows) {
      drawRow(report.columns.map((c) => fmtCell(row[c.key], c.numeric)));
    }
  }

  if (report.summary) {
    doc.moveDown(0.8).fontSize(11).font('Helvetica-Bold').text('Summary');
    doc.font('Helvetica').fontSize(10);
    for (const [key, value] of Object.entries(report.summary)) {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      doc.text(`${label}: ${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`);
    }
  }
}
