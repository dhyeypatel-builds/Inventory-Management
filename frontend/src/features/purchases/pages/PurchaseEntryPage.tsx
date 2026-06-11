import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { isAxiosError } from 'axios';
import { PackagePlus, Trash2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { Separator } from '@/shared/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { SerialChipsInput } from '@/shared/ui/serial-chips-input';
import { toast } from '@/shared/ui/use-toast';
import { formatCurrency } from '@/shared/lib/currency';
import { ItemSearch } from '@/features/sales/components/ItemSearch';
import type { VariantSearchResult } from '@/features/sales/types';
import { VendorPicker, type VendorSelection } from '../components/VendorPicker';
import { useCreatePurchase } from '../hooks/usePurchases';
import type { PurchaseLine } from '../types';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const parseSerials = (text: string): string[] =>
  text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

export function PurchaseEntryPage() {
  const navigate = useNavigate();
  const createPurchase = useCreatePurchase();

  const [vendor, setVendor] = useState<VendorSelection | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  function addLine(variant: VariantSearchResult) {
    setLines((prev) => {
      if (prev.some((l) => l.variantId === variant.id)) {
        return prev.map((l) =>
          l.variantId === variant.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          sku: variant.sku,
          description: `${variant.productName} (${variant.sku})`,
          quantity: 1,
          unitCost: variant.purchasePrice,
          taxRatePct: variant.taxRatePct,
          serialsText: '',
        },
      ];
    });
    setError(null);
  }

  function updateLine(variantId: string, patch: Partial<PurchaseLine>) {
    setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)));
  }

  function removeLine(variantId: string) {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  const totals = lines.reduce(
    (acc, l) => {
      const base = l.unitCost * l.quantity;
      const tax = (base * l.taxRatePct) / 100;
      return {
        subtotal: acc.subtotal + base,
        taxTotal: acc.taxTotal + tax,
        grandTotal: acc.grandTotal + base + tax,
      };
    },
    { subtotal: 0, taxTotal: 0, grandTotal: 0 },
  );

  const serialProblem = lines.find((l) => parseSerials(l.serialsText).length > l.quantity);

  const canSubmit =
    !!vendor &&
    invoiceNo.trim().length > 0 &&
    invoiceDate.length === 10 &&
    lines.length > 0 &&
    lines.every((l) => l.quantity > 0 && l.unitCost >= 0) &&
    !serialProblem &&
    !createPurchase.isPending;

  async function handleSubmit() {
    if (!canSubmit || !vendor) return;
    setError(null);
    try {
      const purchase = await createPurchase.mutateAsync({
        ...(vendor.vendorId ? { vendorId: vendor.vendorId } : { vendorName: vendor.name }),
        invoiceNo: invoiceNo.trim(),
        invoiceDate,
        notes: notes.trim() || undefined,
        items: lines.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          unitCost: l.unitCost,
          taxRatePct: l.taxRatePct,
          serials: parseSerials(l.serialsText),
        })),
      });
      toast({
        title: `Purchase ${purchase.invoiceNo} received`,
        description: 'Stock has been updated.',
        variant: 'success',
      });
      navigate('/purchases');
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data?.error?.message ?? 'Could not save the purchase.')
        : 'Network error.';
      setError(msg);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-sm bg-success/15 text-success">
          <PackagePlus className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Purchase</h1>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Goods inward
          </p>
        </div>
        <Button variant="ghost" size="sm" className="ml-auto" asChild>
          <Link to="/purchases">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Purchase history
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: item search + lines */}
        <div className="space-y-4 lg:col-span-2">
          <ItemSearch onAdd={addLine} includeOutOfStock />

          {lines.length === 0 ? (
            <p className="rounded-sm border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Search for an item above to start receiving stock.
            </p>
          ) : (
            <div className="rounded-sm border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-20 text-right">Qty</TableHead>
                    <TableHead className="w-28 text-right">Unit Cost</TableHead>
                    <TableHead className="w-20 text-right">Tax %</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => {
                    const lineTotal =
                      l.unitCost * l.quantity * (1 + l.taxRatePct / 100);
                    return (
                      <TableRow key={l.variantId}>
                        <TableCell>
                          <div className="font-medium">{l.description}</div>
                          <SerialChipsInput
                            className="mt-1.5"
                            value={l.serialsText}
                            onChange={(text) => updateLine(l.variantId, { serialsText: text })}
                            quantity={l.quantity}
                            label={`Serial numbers for ${l.description}`}
                            placeholder="Serial nos (optional)"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            className="h-9 w-20 text-right font-mono tabular"
                            value={l.quantity}
                            onChange={(e) =>
                              updateLine(l.variantId, {
                                quantity: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            aria-label={`Quantity for ${l.description}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            className="h-9 w-28 text-right font-mono tabular"
                            value={l.unitCost}
                            onChange={(e) =>
                              updateLine(l.variantId, {
                                unitCost: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            aria-label={`Unit cost for ${l.description}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.1"
                            inputMode="decimal"
                            className="h-9 w-20 text-right font-mono tabular"
                            value={l.taxRatePct}
                            onChange={(e) =>
                              updateLine(l.variantId, {
                                taxRatePct: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                              })
                            }
                            aria-label={`Tax rate for ${l.description}`}
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono tabular font-semibold">
                          {formatCurrency(lineTotal)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(l.variantId)}
                            aria-label={`Remove ${l.description}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Right: invoice panel (light green — goods inward) */}
        <div className="lg:col-span-1">
          <div className="space-y-4 rounded-sm border border-success/35 bg-success/[0.07] p-4 shadow-panel lg:sticky lg:top-4">
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Vendor Invoice
            </span>

            <div className="space-y-1.5">
              <Label>
                Vendor <span className="text-destructive">*</span>
              </Label>
              <VendorPicker selected={vendor} onSelect={setVendor} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="purch-invoice-no">
                  Invoice No. <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="purch-invoice-no"
                  className="font-mono"
                  placeholder="VND-2026-001"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="purch-invoice-date">
                  Invoice Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="purch-invoice-date"
                  type="date"
                  className="font-mono"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="purch-notes">Notes</Label>
              <Textarea
                id="purch-notes"
                rows={2}
                placeholder="Delivery ref, condition, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Separator />

            <div className="space-y-2" aria-label="Purchase summary">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono tabular">
                  {totals.subtotal > 0 ? formatCurrency(totals.subtotal) : '—'}
                </span>
              </div>
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

            {error && (
              <p
                className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-[oklch(0.48_0.2_27)]"
                role="alert"
              >
                {error}
              </p>
            )}

            <Button
              className="w-full bg-success text-success-foreground hover:bg-success/90"
              size="lg"
              disabled={!canSubmit}
              onClick={handleSubmit}
              aria-label="Receive stock"
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {createPurchase.isPending
                ? 'Saving…'
                : `Receive Stock · ${formatCurrency(totals.grandTotal)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
