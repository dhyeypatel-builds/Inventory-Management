import { Printer } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { formatCurrency } from '@/shared/lib/currency';
import { formatDate } from '@/shared/lib/dates';
import { useSettings } from '@/features/settings/hooks/useSettings';
import type { SaleDetail, InvoiceCompany } from '../types';

interface InvoiceViewProps {
  sale: SaleDetail;
  /** Company header block (from the /sales/:id/invoice payload or settings). */
  company?: InvoiceCompany;
  onClose?: () => void;
}

const STATUS_VARIANT = {
  CONFIRMED: 'success',
  RETURNED: 'warning',
  CANCELLED: 'destructive',
  DRAFT: 'secondary',
} as const;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Net taxable + VAT grouped by rate (highest first), mirroring the PDF. */
function taxBreakdown(items: SaleDetail['items']): { rate: number; net: number; vat: number }[] {
  const byRate = new Map<number, { net: number; vat: number }>();
  for (const it of items) {
    const net = round2(it.unitPrice * it.quantity - it.discount);
    const vat = round2(it.lineTotal - net);
    const acc = byRate.get(it.taxRatePct) ?? { net: 0, vat: 0 };
    byRate.set(it.taxRatePct, { net: round2(acc.net + net), vat: round2(acc.vat + vat) });
  }
  return [...byRate.entries()]
    .map(([rate, v]) => ({ rate, net: v.net, vat: v.vat }))
    .sort((a, b) => b.rate - a.rate);
}

export function InvoiceView({ sale, company, onClose }: InvoiceViewProps) {
  const co = company ?? sale.company;
  const vatNo = co?.vat_number ?? co?.vat_no ?? co?.gstin;
  // Unregistered shops present a plain "Invoice" with no VAT column/row.
  const { data: settings } = useSettings();
  const vatRegistered = settings?.tax?.vat_registered !== false;
  // Net + VAT grouped by rate, for the per-rate breakdown when rates are mixed.
  const taxByRate = vatRegistered ? taxBreakdown(sale.items) : [];

  return (
    <div className="print-area overflow-hidden rounded-sm border border-border bg-card text-sm shadow-panel print:border-0 print:shadow-none">
      {/* Header band */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-surface-2 px-6 py-5 print:bg-transparent">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-sm bg-primary font-mono text-lg font-bold text-primary-foreground"
          >
            {(co?.name ?? 'TyreStock').charAt(0).toUpperCase()}
          </span>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight">{co?.name ?? 'TyreStock'}</div>
            {co?.address ? (
              <div className="mt-0.5 max-w-56 text-xs text-muted-foreground">{co.address}</div>
            ) : (
              <div className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
                Inventory · POS
              </div>
            )}
            {co?.phone && (
              <div className="font-mono text-xs text-muted-foreground">{co.phone}</div>
            )}
            {vatNo && (
              <div className="font-mono text-xs text-muted-foreground">VAT {vatNo}</div>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <h2 className="text-lg font-bold tracking-tight">
              {vatRegistered ? 'TAX INVOICE' : 'INVOICE'}
            </h2>
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
        <div>
          <div className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
            Billed to
          </div>
          {sale.customer ? (
            <>
              <p className="mt-1 font-semibold">{sale.customer.name}</p>
              {sale.customer.phone && (
                <p className="font-mono text-xs text-muted-foreground">{sale.customer.phone}</p>
              )}
            </>
          ) : sale.customerName ? (
            // Walk-in with a name: show the name above the walk-in tag.
            <>
              <p className="mt-1 font-semibold">{sale.customerName}</p>
              <p className="text-xs italic text-muted-foreground">Walk-in customer</p>
            </>
          ) : (
            <p className="mt-1 font-semibold">Walk-in customer</p>
          )}
        </div>

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
              {vatRegistered && (
                <th className="pb-2 text-right text-[0.62rem] font-bold uppercase tracking-wider">
                  Tax%
                </th>
              )}
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
                  {item.listPrice != null && item.listPrice !== item.unitPrice && (
                    <div className="text-[0.62rem] text-muted-foreground line-through">
                      {formatCurrency(item.listPrice)}
                    </div>
                  )}
                </td>
                <td className="py-2.5 text-right font-mono tabular text-muted-foreground">
                  {item.discount > 0 ? formatCurrency(item.discount) : '—'}
                </td>
                {vatRegistered && (
                  <td className="py-2.5 text-right font-mono tabular text-muted-foreground">
                    {item.taxRatePct}%
                  </td>
                )}
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
            {vatRegistered &&
              (taxByRate.length > 1 ? (
                taxByRate.map((b) => (
                  <div
                    key={b.rate}
                    className="flex justify-between text-sm text-muted-foreground"
                  >
                    <span>
                      VAT {b.rate}% on {formatCurrency(b.net)}
                    </span>
                    <span className="font-mono tabular">{formatCurrency(b.vat)}</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tax</span>
                  <span className="font-mono tabular">{formatCurrency(sale.taxTotal)}</span>
                </div>
              ))}
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
