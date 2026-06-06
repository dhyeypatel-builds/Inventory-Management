import { useState, useCallback, useRef } from 'react';
import { isAxiosError } from 'axios';
import { Banknote, CreditCard, Smartphone, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Separator } from '@/shared/ui/separator';
import { cn } from '@/shared/lib/cn';
import { ItemSearch } from '../components/ItemSearch';
import { Cart, computeTotals } from '../components/Cart';
import { CustomerPicker } from '../components/CustomerPicker';
import { InvoiceView } from '../components/InvoiceView';
import { useCreateSale } from '../hooks/useSales';
import { formatCurrency } from '@/shared/lib/currency';
import { toast } from '@/shared/ui/use-toast';
import type { CartItem, VariantSearchResult, Customer, SaleDetail, PaymentMode } from '../types';

const PAYMENT_MODES: { value: PaymentMode; label: string; icon: typeof Banknote }[] = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'CARD', label: 'Card', icon: CreditCard },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Smartphone },
];

function generateIdempotencyKey(): string {
  return `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PosPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [stockError, setStockError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<SaleDetail | null>(null);

  // Stable idempotency key per "checkout session" — regenerated after sale completes
  const idempotencyKeyRef = useRef(generateIdempotencyKey());

  const createSale = useCreateSale();

  function addToCart(variant: VariantSearchResult) {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.variantId === variant.id);
      if (existing) {
        return prev.map((i) =>
          i.variantId === variant.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          sku: variant.sku,
          description: `${variant.productName} (${variant.sku})`,
          quantity: 1,
          unitPrice: variant.sellingPrice,
          discount: 0,
          taxRatePct: variant.taxRatePct,
        },
      ];
    });
    setStockError(null);
  }

  const changeQty = useCallback((variantId: string, qty: number) => {
    setCartItems((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, quantity: qty } : i)),
    );
  }, []);

  const changeDiscount = useCallback((variantId: string, discount: number) => {
    setCartItems((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, discount } : i)),
    );
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setCartItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  async function handleConfirm() {
    if (cartItems.length === 0) return;
    setStockError(null);

    try {
      const sale = await createSale.mutateAsync({
        payload: {
          customerId: customer?.id,
          paymentMode,
          items: cartItems.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount,
          })),
        },
        idempotencyKey: idempotencyKeyRef.current,
      });

      setCompletedSale(sale);
      setCartItems([]);
      setCustomer(null);
      setPaymentMode('CASH');
      idempotencyKeyRef.current = generateIdempotencyKey();
    } catch (err) {
      if (isAxiosError(err)) {
        const errorData = err.response?.data?.error;
        if (errorData?.code === 'INSUFFICIENT_STOCK') {
          const details = errorData.details as Array<{
            variantId: string;
            available: number;
            requested: number;
          }>;
          const lines = details
            .map((d) => `${d.variantId}: need ${d.requested}, have ${d.available}`)
            .join('; ');
          setStockError(`Insufficient stock: ${lines}`);
        } else {
          toast({
            title: 'Sale failed',
            description: errorData?.message ?? 'Please try again.',
            variant: 'destructive',
          });
        }
      } else {
        toast({ title: 'Network error', variant: 'destructive' });
      }
    }
  }

  const totals = computeTotals(cartItems);

  if (completedSale) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-sm bg-success/12 text-[oklch(0.45_0.13_150)]">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Sale Complete</h1>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Invoice generated
              </p>
            </div>
          </div>
          <Button onClick={() => setCompletedSale(null)}>New Sale</Button>
        </div>
        <InvoiceView sale={completedSale} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Point of Sale</h1>
        <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          New sale
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: search + cart */}
        <div className="space-y-4 lg:col-span-2">
          <ItemSearch onAdd={addToCart} />
          <Cart
            items={cartItems}
            onChangeQty={changeQty}
            onChangeDiscount={changeDiscount}
            onRemove={removeItem}
          />
        </div>

        {/* Right: checkout panel */}
        <div className="lg:col-span-1">
          <div className="space-y-4 rounded-sm border border-border bg-card p-4 shadow-panel lg:sticky lg:top-4">
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Checkout
            </span>

            <div className="space-y-1.5">
              <Label>Customer (optional)</Label>
              <CustomerPicker selected={customer} onSelect={setCustomer} />
            </div>

            <div className="space-y-1.5">
              <Label>Payment Mode</Label>
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Payment mode">
                {PAYMENT_MODES.map(({ value, label, icon: Icon }) => {
                  const active = paymentMode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPaymentMode(value)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-sm border px-2 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        active
                          ? 'border-primary bg-primary/12 text-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                      )}
                    >
                      <Icon className={cn('h-4 w-4', active && 'text-primary')} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Summary */}
            <div className="space-y-2" aria-label="Order summary">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono tabular">
                  {totals.subtotal > 0 ? formatCurrency(totals.subtotal) : '—'}
                </span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Discount</span>
                  <span className="font-mono tabular">−{formatCurrency(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tax</span>
                <span className="font-mono tabular">
                  {totals.taxTotal > 0 ? formatCurrency(totals.taxTotal) : '—'}
                </span>
              </div>
              <div className="flex items-end justify-between border-t border-border pt-2.5">
                <span className="text-sm font-semibold">Grand Total</span>
                <span className="font-mono tabular text-2xl font-bold leading-none tracking-tight">
                  {formatCurrency(totals.grandTotal)}
                </span>
              </div>
            </div>

            {/* Stock error */}
            {stockError && (
              <p
                className="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-[oklch(0.48_0.2_27)]"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{stockError}</span>
              </p>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={cartItems.length === 0 || createSale.isPending}
              onClick={handleConfirm}
              aria-label="Confirm sale"
            >
              {createSale.isPending ? 'Processing…' : `Confirm Sale · ${formatCurrency(totals.grandTotal)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
