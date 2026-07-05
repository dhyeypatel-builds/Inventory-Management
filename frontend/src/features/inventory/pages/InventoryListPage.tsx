import { useState } from 'react';
import { Link } from 'react-router';
import { Search, Filter, Boxes } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Label } from '@/shared/ui/label';
import { EmptyState } from '@/shared/ui/empty-state';
import { InventoryTable } from '../components/InventoryTable';
import { AdjustStockDialog } from '../components/AdjustStockDialog';
import { MovementLedgerDrawer } from '../components/MovementLedgerDrawer';
import { useInventory, useValuation } from '../hooks/useInventory';
import { formatCurrency } from '@/shared/lib/currency';
import type { InventoryItem } from '../types';

export function InventoryListPage() {
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const [ledgerItem, setLedgerItem] = useState<InventoryItem | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  const { data, isLoading } = useInventory({
    q: search || undefined,
    lowStock: lowStockOnly || undefined,
    page,
    pageSize: 20,
  });

  // Whole-shop stock valuation (independent of the search/low-stock filters).
  const { data: valuation } = useValuation();
  const totalUnits = valuation?.byBrand.reduce((sum, b) => sum + b.totalQty, 0) ?? 0;

  const meta = data?.meta;

  function openAdjust(item: InventoryItem) {
    setAdjustItem(item);
    setAdjustOpen(true);
  }

  function openLedger(item: InventoryItem) {
    setLedgerItem(item);
    setLedgerOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Stock on hand
          </p>
        </div>

        {/* Whole-shop stock valuation (at cost price) */}
        {valuation && (
          <div className="rounded-sm border border-border bg-card px-4 py-2.5 text-right shadow-panel">
            <div className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
              Stock value · at cost
            </div>
            <div className="mt-0.5 font-mono tabular text-xl font-bold leading-none">
              {formatCurrency(valuation.totalValue)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {totalUnits.toLocaleString()} {totalUnits === 1 ? 'unit' : 'units'} on hand
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products…"
            className="pl-8"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="lowStock"
            checked={lowStockOnly}
            onCheckedChange={(v) => { setLowStockOnly(v === true); setPage(1); }}
          />
          <Label htmlFor="lowStock" className="flex items-center gap-1.5 cursor-pointer select-none">
            <Filter className="h-3.5 w-3.5" />
            Low stock only
          </Label>
        </div>
      </div>

      {!isLoading && data?.items?.length === 0 && !search && !lowStockOnly ? (
        <EmptyState
          icon={Boxes}
          title="No stock yet"
          description="Inventory appears here once you add products or receive a purchase."
          action={
            <Button asChild>
              <Link to="/products/new">Add a product</Link>
            </Button>
          }
        />
      ) : (
        <InventoryTable
          items={data?.items}
          loading={isLoading}
          onAdjust={openAdjust}
          onViewLedger={openLedger}
        />
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.total} items
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

      <AdjustStockDialog
        item={adjustItem}
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
      />

      <MovementLedgerDrawer
        item={ledgerItem}
        open={ledgerOpen}
        onOpenChange={setLedgerOpen}
      />
    </div>
  );
}
