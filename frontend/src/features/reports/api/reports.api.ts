import { api } from '@/shared/api/client';
import type { ReportName, ReportQuery, ReportResult } from '../types';

export async function getReport(name: ReportName, query: ReportQuery = {}): Promise<ReportResult> {
  const res = await api.get(`/reports/${name}`, { params: query });
  return res.data.data as ReportResult;
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

const MIME: Record<ExportFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

export async function exportReport(
  name: ReportName,
  format: ExportFormat,
  query: ReportQuery = {},
): Promise<void> {
  const res = await api.get(`/reports/${name}/export`, {
    params: { ...query, format },
    responseType: 'blob',
  });

  const blob = new Blob([res.data as BlobPart], { type: MIME[format] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-report.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
