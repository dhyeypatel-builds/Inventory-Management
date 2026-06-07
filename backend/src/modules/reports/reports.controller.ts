import type { Request, Response, NextFunction } from 'express';
import * as reportService from './reports.service';
import type { ReportName, ReportQuery } from './reports.service';
import { reportToXlsx } from './xlsx';
import { renderReportHtml, REPORT_FOOTER_HTML } from './templates/report-html';
import { getReportBranding } from './branding';
import { htmlToPdf } from '../../render/pdf.service';
import { success } from '../../utils/apiResponse';
import { ValidationError } from '../../utils/errors';

const FORMATS = ['csv', 'xlsx', 'pdf'] as const;
type Format = (typeof FORMATS)[number];

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const buildQuery = (req: Request): ReportQuery => ({
  from: typeof req.query.from === 'string' ? req.query.from : undefined,
  to: typeof req.query.to === 'string' ? req.query.to : undefined,
  limit: req.query.limit !== undefined ? Number(req.query.limit) : undefined,
});

export const getReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const name = req.params.name as ReportName;
    const report = await reportService.generateReport(name, buildQuery(req));
    success(res, report);
  } catch (err) {
    next(err);
  }
};

export const exportReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const name = req.params.name as ReportName;
    const format = ((req.query.format as string) ?? 'csv') as Format;
    if (!FORMATS.includes(format)) {
      throw new ValidationError(`Unsupported format. Use one of: ${FORMATS.join(', ')}`);
    }

    const report = await reportService.generateReport(name, buildQuery(req));
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${name}-${stamp}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (format === 'pdf') {
      // Branded PDF: per-tenant HTML template → headless Chrome (Phase 2D).
      const branding = await getReportBranding();
      const html = renderReportHtml(report, branding);
      const pdf = await htmlToPdf(html, { landscape: true, footerHtml: REPORT_FOOTER_HTML });
      res.setHeader('Content-Type', 'application/pdf');
      res.status(200).send(pdf);
      return;
    }

    if (format === 'xlsx') {
      const buffer = await reportToXlsx(report);
      res.setHeader('Content-Type', XLSX_MIME);
      res.status(200).send(buffer);
      return;
    }

    const csv = reportService.reportToCsv(report);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};
