import ExcelJS from 'exceljs';
import type { ReportResult } from './reports.service';
import { CURRENCY_KEYS, CURRENCY_SUMMARY_KEYS, humanizeSummaryKey } from './report-format';

const GBP_FMT = '£#,##0.00';
const NUM_FMT = '#,##0.##';
const INK = 'FF1C1F24';
const AMBER = 'FFE8820C';

/**
 * Renders a ReportResult to a real .xlsx workbook: typed numeric/currency cells
 * (not text), a frozen bold header, sensible widths, and a bold summary block.
 */
export async function reportToXlsx(report: ReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TyreStock';
  wb.created = new Date(report.generatedAt);

  const sheetName = report.title.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Report';
  const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = report.columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: Math.min(Math.max(c.label.length + 4, 12), 40),
    style: c.numeric ? { numFmt: CURRENCY_KEYS.has(c.key) ? GBP_FMT : NUM_FMT } : {},
  }));

  // Header styling.
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
  header.alignment = { vertical: 'middle' };
  report.columns.forEach((c, i) => {
    if (c.numeric) ws.getColumn(i + 1).alignment = { horizontal: 'right' };
  });

  // Data rows — numeric values stay numeric so Excel can sum them.
  for (const row of report.rows) {
    const values: Record<string, unknown> = {};
    for (const c of report.columns) {
      const v = row[c.key];
      values[c.key] = c.numeric && typeof v === 'number' ? v : v ?? '';
    }
    ws.addRow(values);
  }

  if (report.rows.length === 0) {
    ws.addRow([]);
    ws.addRow(['No data for the selected period.']).font = { italic: true, color: { argb: 'FF777777' } };
  }

  // Summary block.
  if (report.summary && Object.keys(report.summary).length > 0) {
    ws.addRow([]);
    const title = ws.addRow(['Summary']);
    title.font = { bold: true, color: { argb: INK } };
    for (const [key, value] of Object.entries(report.summary)) {
      const r = ws.addRow([humanizeSummaryKey(key), value]);
      r.getCell(1).font = { bold: true };
      r.getCell(2).numFmt = CURRENCY_SUMMARY_KEYS.has(key) ? GBP_FMT : NUM_FMT;
      r.getCell(2).alignment = { horizontal: 'right' };
    }
  }

  // Amber accent on the header bottom border.
  header.border = { bottom: { style: 'thick', color: { argb: AMBER } } };

  // exceljs returns its own Buffer type; it's a Node Buffer at runtime.
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}
