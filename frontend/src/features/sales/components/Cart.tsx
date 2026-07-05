import { Trash2, Minus, Plus, ShoppingCart } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { SerialChipsInput } from '@/shared/ui/serial-chips-input';
import { formatCurrency } from '@/shared/lib/currency';
import { cn } from '@/shared/lib/cn';
import type { CartItem } from '../types';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeTotals(items: CartItem[], vatRegistered = true) {
  let subtotal = 0;
  let discount = 0;
  let taxTotal = 0;
  for (const item of items) {
    const lineBase = round2(item.unitPrice * item.quantity);
    const taxable = round2(lineBase - item.discount);
    // Unregistered shops charge no VAT, mirroring the server-side rule.
    const lineTax = vatRegistered ? round2((taxable * item.taxRatePct) / 100) : 0;
    subtotal += lineBase;
    discount += item.discount;
    taxTotal += lineTax;
  }
  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    taxTotal: round2(taxTotal),
    grandTotal: round2(subtotal - discount + taxTotal),
  };
}

interface CartProps {
  items: CartItem[];
  onChangeQty: (variantId: string, qty: number) => void;
  onChangeDiscount: (variantId: string, discount: number) => void;
  onChangeSerials?: (variantId: string, serialsText: string) => void;
  /** Provided only when the user may override prices (sale:override_price). */
  onChangePrice?: (variantId: string, unitPrice: number) => void;
  /** When false (shop not VAT-registered), lines carry no tax. */
  vatRegistered?: boolean;
  onRemove: (variantId: string) => void;
}

export function Cart({
  items,
  onChangeQty,
  onChangeDiscount,
  onChangeSerials,
  onChangePrice,
  vatRegistered = true,
  onRemove,
}: CartProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-border text-sm text-muted-foreground">
        <ShoppingCart className="h-6 w-6 text-muted-foreground/60" />
        Cart is empty. Search and add products above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Cart
        </span>
        <span className="font-mono text-[0.68rem] tabular text-muted-foreground">
          {items.length} {items.length === 1 ? 'line' : 'lines'}
        </span>
      </div>

      {items.map((item) => {
        const lineBase = round2(item.unitPrice * item.quantity);
        const taxable = round2(lineBase - item.discount);
        const lineTax = vatRegistered ? round2((taxable * item.taxRatePct) / 100) : 0;
        const lineTotal = round2(taxable + lineTax);
        const isOverridden = round2(item.unitPrice) !== round2(item.listPrice);

        return (
          <div key={item.variantId} className="space-y-2.5 rounded-sm border border-border bg-card p-3 shadow-panel">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{item.description}</div>
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {isOverridden ? (
                    <>
                      <span className="text-foreground">{formatCurrency(item.unitPrice)}</span>{' '}
                      <span className="line-through">{formatCurrency(item.listPrice)}</span> ea
                    </>
                  ) : (
                    <>{formatCurrency(item.unitPrice)} ea</>
                  )}
                  {vatRegistered && <> · {item.taxRatePct}% tax</>}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(item.variantId)}
                aria-label={`Remove ${item.description} from cart`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {/* Qty stepper — buttons flank a typeable input */}
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-r-none"
                  onClick={() => onChangeQty(item.variantId, Math.max(1, item.quantity - 1))}
                  aria-label={`Decrease ${item.description} qty`}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Input
                  id={`qty-${item.variantId}`}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  className="h-9 w-12 rounded-none border-x-0 text-center font-mono tabular text-sm"
                  value={item.quantity}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v > 0) onChangeQty(item.variantId, v);
                  }}
                  aria-label={`Quantity for ${item.description}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-l-none"
                  onClick={() => onChangeQty(item.variantId, item.quantity + 1)}
                  aria-label={`Increase ${item.description} qty`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {onChangePrice && (
                <div className="flex items-center gap-1.5">
                  <label
                    className="font-mono text-[0.68rem] uppercase tracking-wide text-muted-foreground"
                    htmlFor={`price-${item.variantId}`}
                  >
                    Price £
                  </label>
                  <Input
                    id={`price-${item.variantId}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    className={cn(
                      'h-9 w-24 font-mono tabular text-sm',
                      isOverridden && 'border-primary text-foreground',
                    )}
                    value={item.unitPrice}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v >= 0) onChangePrice(item.variantId, round2(v));
                    }}
                    aria-label={`Unit price for ${item.description}`}
                  />
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <label
                  className="font-mono text-[0.68rem] uppercase tracking-wide text-muted-foreground"
                  htmlFor={`discount-${item.variantId}`}
                >
                  Disc £
                </label>
                <Input
                  id={`discount-${item.variantId}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  className="h-9 w-20 font-mono tabular text-sm"
                  value={item.discount}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v >= 0) onChangeDiscount(item.variantId, v);
                  }}
                  aria-label={`Discount for ${item.description}`}
                />
              </div>

              <div className={cn('ml-auto font-mono tabular text-sm font-bold', item.discount > 0 && 'text-foreground')}>
                {formatCurrency(lineTotal)}
              </div>
            </div>

            {onChangeSerials && (
              <SerialChipsInput
                value={item.serialsText ?? ''}
                onChange={(text) => onChangeSerials(item.variantId, text)}
                quantity={item.quantity}
                label={`Serial numbers for ${item.description}`}
                placeholder="Serial nos (optional)"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
