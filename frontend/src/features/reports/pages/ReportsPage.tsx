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
import { FileSpreadsheet, FileText, FileType, Loader2 } from 'lucide-react';
import { toast } from '@/shared/ui/use-toast';
import { Toaster } from '@/shared/ui/toaster';
import { formatCurrency } from '@/shared/lib/currency';
import { useReport } from '../hooks/useReports';
import { exportReport, type ExportFormat } from '../api/reports.api';
import { ReportSelector } from '../components/ReportSelector';
import { DateRangePicker } from '../components/DateRangePicker';
import type { ReportName } from '../types';

// Money columns/summary keys (kept in sync with the backend report-format.ts).
const CURRENCY_KEYS = new Set([
  'subtotal', 'discount', 'taxTotal', 'grandTotal', 'revenue', 'totalValue', 'taxableAmount', 'taxAmount',
]);
const CURRENCY_SUMMARY_KEYS = new Set([
  'totalRevenue', 'totalDiscount', 'totalTax', 'totalSubtotal', 'grandTotal', 'totalValue', 'totalTaxCollected', 'totalTaxableAmount',
]);

const EXPORTS: { format: ExportFormat; label: string; icon: typeof FileText }[] = [
  { format: 'pdf', label: 'PDF', icon: FileType },
  { format: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { format: 'csv', label: 'CSV', icon: FileText },
];

export function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportName | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  const query = { from: from || undefined, to: to || undefined };
  const { data: report, isLoading, isError } = useReport(selectedReport, query);

  async function handleExport(format: ExportFormat) {
    if (!selectedReport) return;
    setExportingFormat(format);
    try {
      await exportReport(selectedReport, format, query);
      toast({ title: `Exported as ${format.toUpperCase()}`, variant: 'success' });
    } catch {
      toast({ title: `${format.toUpperCase()} export failed`, variant: 'destructive' });
    } finally {
      setExportingFormat(null);
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
          <div className="flex items-center gap-2">
            <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Export
            </span>
            {EXPORTS.map(({ format, label, icon: Icon }) => (
              <Button
                key={format}
                variant="outline"
                size="sm"
                disabled={exportingFormat !== null}
                onClick={() => handleExport(format)}
                aria-label={`Export ${label}`}
              >
                {exportingFormat === format ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="mr-2 h-4 w-4" />
                )}
                {label}
              </Button>
            ))}
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
                    {typeof v === 'number'
                      ? CURRENCY_SUMMARY_KEYS.has(k)
                        ? formatCurrency(v)
                        : v.toLocaleString('en-GB')
                      : v}
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
                          {(() => {
                            const v = row[col.key];
                            if (v == null || v === '') return '—';
                            if (col.numeric && typeof v === 'number') {
                              return CURRENCY_KEYS.has(col.key) ? formatCurrency(v) : v.toLocaleString('en-GB');
                            }
                            return String(v);
                          })()}
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
