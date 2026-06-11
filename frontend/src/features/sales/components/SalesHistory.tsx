import { useState } from 'react';
import { Link } from 'react-router';
import { Eye, ShoppingCart } from 'lucide-react';
import { EmptyState } from '@/shared/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { Dialog, DialogContent } from '@/shared/ui/dialog';
import { formatCurrency } from '@/shared/lib/currency';
import { formatDateTime } from '@/shared/lib/dates';
import { DateRangePicker } from '@/features/reports/components/DateRangePicker';
import { useSales, useSale, useSaleInvoice } from '../hooks/useSales';
import { InvoiceView } from './InvoiceView';

const STATUS_VARIANT: Record<string, 'success' | 'outline' | 'destructive' | 'secondary'> = {
  CONFIRMED: 'success',
  DRAFT: 'secondary',
  CANCELLED: 'destructive',
  RETURNED: 'outline',
};

export function SalesHistory() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [viewId, setViewId] = useState<string | null>(null);

  const { data, isLoading } = useSales({
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: 20,
  });

  const { data: invoiceSale } = useSale(viewId ?? '');
  const { data: invoicePayload } = useSaleInvoice(viewId ?? '');

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      {/* Date filters */}
      <div className="flex flex-wrap items-end gap-3">
        <DateRangePicker
          from={from}
          to={to}
          onFromChange={(v) => { setFrom(v); setPage(1); }}
          onToChange={(v) => { setTo(v); setPage(1); }}
        />
        {(from || to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFrom(''); setTo(''); setPage(1); }}
          >
            Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : items.length === 0 ? (
        !from && !to ? (
          <EmptyState
            icon={ShoppingCart}
            title="No sales yet"
            description="Ring up your first sale and the invoice will appear here."
            action={
              <Button asChild>
                <Link to="/sales/pos">New Sale</Link>
              </Button>
            }
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No sales in this date range.
          </div>
        )
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="whitespace-nowrap text-right">Grand Total</TableHead>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs font-medium">
                    {sale.invoiceNo}
                  </TableCell>
                  <TableCell className="text-sm">{sale.customerName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[sale.status] ?? 'outline'} className="text-xs">
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular text-sm text-muted-foreground">
                    {sale.itemCount}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {sale.paymentMode ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular text-base font-semibold">
                    {formatCurrency(sale.grandTotal)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {formatDateTime(sale.soldAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewId(sale.id)}
                      aria-label={`View invoice ${sale.invoiceNo}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.total} sales
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Invoice modal */}
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="print-dialog max-w-3xl max-h-[90vh] overflow-y-auto">
          {invoiceSale && (
            <InvoiceView
              sale={invoiceSale}
              company={invoicePayload?.company}
              onClose={() => setViewId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
