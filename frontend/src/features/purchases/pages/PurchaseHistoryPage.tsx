import { useState } from 'react';
import { Link } from 'react-router';
import { Eye, PackagePlus } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { formatCurrency } from '@/shared/lib/currency';
import { formatDate, formatDateTime } from '@/shared/lib/dates';
import { EmptyState } from '@/shared/ui/empty-state';
import { usePurchases, usePurchase } from '../hooks/usePurchases';
import { VendorsManager } from '../components/VendorsManager';

type View = 'purchases' | 'vendors';

export function PurchaseHistoryPage() {
  const [view, setView] = useState<View>('purchases');
  const [page, setPage] = useState(1);
  const [viewId, setViewId] = useState<string | null>(null);

  const { data, isLoading } = usePurchases({ page, pageSize: 20 });
  const { data: detail } = usePurchase(viewId ?? '');

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchases</h1>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Goods inward
          </p>
        </div>
        <Button asChild className="bg-success text-success-foreground hover:bg-success/90">
          <Link to="/purchases/new">
            <PackagePlus className="mr-1.5 h-4 w-4" />
            New Purchase
          </Link>
        </Button>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Purchases sections">
        {([
          { value: 'purchases', label: 'Purchases' },
          { value: 'vendors', label: 'Vendors' },
        ] as { value: View; label: string }[]).map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={view === t.value}
            onClick={() => setView(t.value)}
            className={
              view === t.value
                ? 'rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
                : 'rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'vendors' ? (
        <VendorsManager />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={PackagePlus}
          title="No purchases yet"
          description="Receive your first delivery and the goods-inward record will appear here."
          action={
            <Button asChild className="bg-success text-success-foreground hover:bg-success/90">
              <Link to="/purchases/new">New Purchase</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-success/[0.07]">
                <TableHead className="whitespace-nowrap">Invoice No.</TableHead>
                <TableHead className="whitespace-nowrap">Invoice Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right whitespace-nowrap">Grand Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="whitespace-nowrap">Received</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap font-mono text-sm font-semibold">
                    {p.invoiceNo}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {formatDate(p.invoiceDate)}
                  </TableCell>
                  <TableCell className="font-medium">{p.vendorName ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono tabular">{p.itemCount}</TableCell>
                  <TableCell className="text-right font-mono tabular text-base font-semibold">
                    {formatCurrency(p.grandTotal)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'RECEIVED' ? 'success' : 'destructive'}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {formatDateTime(p.receivedAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewId(p.id)}
                      aria-label={`View purchase ${p.invoiceNo}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground">
                Page {meta.page} of {meta.totalPages}
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
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono">{detail.invoiceNo}</span>
                  <Badge variant={detail.status === 'RECEIVED' ? 'success' : 'destructive'}>
                    {detail.status}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
                    Vendor
                  </div>
                  <p className="mt-0.5 font-semibold">{detail.vendor?.name ?? '—'}</p>
                  {detail.vendor?.phone && (
                    <p className="font-mono text-xs text-muted-foreground">{detail.vendor.phone}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
                    Invoice date
                  </div>
                  <p className="mt-0.5 font-mono">{formatDate(detail.invoiceDate)}</p>
                </div>
              </div>

              <div className="rounded-sm border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Unit Cost</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell>
                          <div className="font-medium">{it.description}</div>
                          {it.serials.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {it.serials.map((s) => (
                                <span
                                  key={s.serialNo}
                                  className="rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[0.65rem]"
                                  title={s.status}
                                >
                                  {s.serialNo}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular">{it.quantity}</TableCell>
                        <TableCell className="text-right font-mono tabular">
                          {formatCurrency(it.unitCost)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular font-semibold">
                          {formatCurrency(it.lineTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <div className="w-56 space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono tabular">{formatCurrency(detail.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax</span>
                    <span className="font-mono tabular">{formatCurrency(detail.taxTotal)}</span>
                  </div>
                  <div className="flex items-end justify-between border-t border-border pt-2">
                    <span className="font-semibold">Grand Total</span>
                    <span className="font-mono tabular text-lg font-bold">
                      {formatCurrency(detail.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {detail.notes && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold">Notes:</span> {detail.notes}
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
