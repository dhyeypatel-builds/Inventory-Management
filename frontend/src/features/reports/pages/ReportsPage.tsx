import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import { Download } from 'lucide-react';
import { toast } from '@/shared/ui/use-toast';
import { Toaster } from '@/shared/ui/toaster';
import { useReport } from '../hooks/useReports';
import { exportReport } from '../api/reports.api';
import { ReportSelector } from '../components/ReportSelector';
import { DateRangePicker } from '../components/DateRangePicker';
import type { ReportName } from '../types';

export function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportName | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);

  const query = { from: from || undefined, to: to || undefined };
  const { data: report, isLoading, isError } = useReport(selectedReport, query);

  async function handleExport(format: 'csv' | 'pdf') {
    if (!selectedReport) return;
    setExporting(true);
    try {
      await exportReport(selectedReport, format, query);
      toast({ title: `Exported as ${format.toUpperCase()}`, variant: 'success' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Business reports
        </p>
      </div>

      <ReportSelector value={selectedReport} onChange={setSelectedReport} />

      <div className="flex flex-wrap items-end gap-4">
        <DateRangePicker
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
        />
        {selectedReport && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExport('csv')}
              aria-label="Export CSV"
            >
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExport('pdf')}
              aria-label="Export PDF"
            >
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>
        )}
      </div>

      {!selectedReport && (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          Select a report type above to view data.
        </div>
      )}

      {selectedReport && isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {selectedReport && isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load report. Please try again.
        </div>
      )}

      {report && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold">{report.title}</p>
            <p className="font-mono text-xs text-muted-foreground">
              Generated: {new Date(report.generatedAt).toLocaleString('en-GB')}
            </p>
          </div>

          {report.summary && Object.keys(report.summary).length > 0 && (
            <div className="flex flex-wrap gap-4 rounded-md border p-4">
              {Object.entries(report.summary).map(([k, v]) => (
                <div key={k} className="text-sm">
                  <p className="text-xs text-muted-foreground capitalize">
                    {k.replace(/_/g, ' ')}
                  </p>
                  <p className="font-mono tabular text-base font-semibold">
                    {typeof v === 'number' ? v.toLocaleString('en-GB') : v}
                  </p>
                </div>
              ))}
            </div>
          )}

          {report.rows.length === 0 ? (
            <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
              No data for the selected range.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {report.columns.map((col) => (
                      <TableHead
                        key={col.key}
                        className={col.numeric ? 'whitespace-nowrap text-right' : 'whitespace-nowrap'}
                      >
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, i) => (
                    <TableRow key={i}>
                      {report.columns.map((col) => (
                        <TableCell
                          key={col.key}
                          className={col.numeric ? 'text-right font-mono tabular text-sm' : undefined}
                        >
                          {row[col.key] != null ? String(row[col.key]) : '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <Toaster />
    </div>
  );
}
