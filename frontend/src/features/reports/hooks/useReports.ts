import { useQuery } from '@tanstack/react-query';
import { getReport } from '../api/reports.api';
import type { ReportName, ReportQuery } from '../types';

export function useReport(name: ReportName | null, query: ReportQuery = {}) {
  return useQuery({
    queryKey: ['reports', name, query],
    queryFn: () => getReport(name!, query),
    enabled: !!name,
  });
}
