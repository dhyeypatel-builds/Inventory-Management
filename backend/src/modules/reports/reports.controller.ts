import type { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import * as reportService from './reports.service';
import type { ReportName, ReportQuery } from './reports.service';
import { success } from '../../utils/apiResponse';

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
    const format = (req.query.format as string) ?? 'csv';
    const report = await reportService.generateReport(name, buildQuery(req));
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${name}-${stamp}.${format}`;

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
      doc.pipe(res);
      reportService.writeReportToPdf(doc, report);
      doc.end();
      return;
    }

    // Default: CSV
    const csv = reportService.reportToCsv(report);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};
