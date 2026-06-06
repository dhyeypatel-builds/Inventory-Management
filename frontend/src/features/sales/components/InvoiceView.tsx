import { Printer } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { formatCurrency } from '@/shared/lib/currency';
import { formatDate } from '@/shared/lib/dates';
import type { SaleDetail } from '../types';

interface InvoiceViewProps {
  sale: SaleDetail;
  onClose?: () => void;
}

const STATUS_VARIANT = {
  CONFIRMED: 'success',
  RETURNED: 'warning',
  CANCELLED: 'destructive',
  DRAFT: 'secondary',
} as const;

export function InvoiceView({ sale, onClose }: InvoiceViewProps) {
  return (
    <div className="overflow-hidden rounded-sm border border-border bg-card text-sm shadow-panel print:border-0 print:shadow-none">
      {/* Header band */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-surface-2 px-6 py-5 print:bg-transparent">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-sm bg-primary font-mono text-lg font-bold text-primary-foreground"
          >
            T
          </span>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight">TyreStock</div>
            <div className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
              Inventory · POS
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <h2 className="text-lg font-bold tracking-tight">TAX INVOICE</h2>
            <Badge variant={STATUS_VARIANT[sale.status]}>{sale.status}</Badge>
          </div>
          <dl className="mt-1.5 space-y-0.5 font-mono text-xs text-muted-foreground">
            <div className="flex justify-end gap-2">
              <dt>No</dt>
              <dd className="font-semibold text-foreground">{sale.invoiceNo}</dd>
            </div>
            <div className="flex justify-end gap-2">
              <dt>Date</dt>
              <dd>{formatDate(sale.soldAt)}</dd>
            </div>
            {sale.paymentMode && (
              <div className="flex justify-end gap-2">
                <dt>Paid via</dt>
                <dd>{sale.paymentMode}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="space-y-5 p-6">
        {/* Customer */}
        {sale.customer && (
          <div>
            <div className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
              Billed to
            </div>
            <p className="mt-1 font-semibold">{sale.customer.name}</p>
            {sale.customer.phone && (
              <p className="font-mono text-xs text-muted-foreground">{sale.customer.phone}</p>
            )}
          </div>
        )}

        {/* Line items */}
        <table className="w-full border-collapse text-sm" aria-label="Invoice items">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="pb-2 text-left text-[0.62rem] font-bold uppercase tracking-wider">
                Description
              </th>
              <th className="pb-2 text-right text-[0.62rem] font-bold uppercase tracking-wider">
                Qty
              </th>
              <th className="pb-2 text-right text-[0.62rem] font-bold uppercase tracking-wider">
                Unit Price
              </th>
              <th className="pb-2 text-right text-[0.62rem] font-bold uppercase tracking-wider">
                Disc
              </th>
              <th className="pb-2 text-right text-[0.62rem] font-bold uppercase tracking-wider">
                Tax%
              </th>
              <th className="pb-2 text-right text-[0.62rem] font-bold uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="border-b border-border/60 last:border-0">
                <td className="py-2.5 pr-2">
                  <div className="font-medium">{item.description}</div>
                  {item.sku && (
                    <div className="font-mono text-xs text-muted-foreground">{item.sku}</div>
                  )}
                </td>
                <td className="py-2.5 text-right font-mono tabular">{item.quantity}</td>
                <td className="py-2.5 text-right font-mono tabular">
                  {formatCurrency(item.unitPrice)}
                </td>
                <td className="py-2.5 text-right font-mono tabular text-muted-foreground">
                  {item.discount > 0 ? formatCurrency(item.discount) : '—'}
                </td>
                <td className="py-2.5 text-right font-mono tabular text-muted-foreground">
                  {item.taxRatePct}%
                </td>
                <td className="py-2.5 text-right font-mono tabular font-semibold">
                  {formatCurrency(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1.5" aria-label="Invoice totals">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono tabular">{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Discount</span>
                <span className="font-mono tabular">−{formatCurrency(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Tax</span>
              <span className="font-mono tabular">{formatCurrency(sale.taxTotal)}</span>
            </div>
            <div className="mt-1 flex items-end justify-between border-t border-border pt-2.5">
              <span className="text-sm font-semibold">Grand Total</span>
              <span className="font-mono tabular text-2xl font-bold leading-none tracking-tight">
                {formatCurrency(sale.grandTotal)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
            Thank you for your business
          </p>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-4 w-4" />
              Print
            </Button>
            {onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
