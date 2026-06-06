import { api } from '@/shared/api/client';
import type { ReportName, ReportQuery, ReportResult } from '../types';

export async function getReport(name: ReportName, query: ReportQuery = {}): Promise<ReportResult> {
  const res = await api.get(`/reports/${name}`, { params: query });
  return res.data.data as ReportResult;
}

export async function exportReport(
  name: ReportName,
  format: 'csv' | 'pdf',
  query: ReportQuery = {},
): Promise<void> {
  const res = await api.get(`/reports/${name}/export`, {
    params: { ...query, format },
    responseType: 'blob',
  });

  const ext = format === 'csv' ? 'csv' : 'pdf';
  const mime = format === 'csv' ? 'text/csv' : 'application/pdf';
  const blob = new Blob([res.data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-report.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}
