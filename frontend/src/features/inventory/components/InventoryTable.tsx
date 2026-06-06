import { AlertTriangle } from 'lucide-react';
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
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/currency';
import type { InventoryItem } from '../types';

interface InventoryTableProps {
  items?: InventoryItem[];
  loading?: boolean;
  onAdjust: (item: InventoryItem) => void;
  onViewLedger: (item: InventoryItem) => void;
}

export function InventoryTable({ items, loading, onAdjust, onViewLedger }: InventoryTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No inventory items found.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product / SKU</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead className="text-right">On Hand</TableHead>
            <TableHead className="text-right">Reorder At</TableHead>
            <TableHead>Rack</TableHead>
            <TableHead className="text-right">Selling Price</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const out = item.onHand === 0;
            return (
              <TableRow
                key={item.variantId}
                className={
                  out
                    ? 'bg-destructive/[0.06] hover:bg-destructive/10'
                    : item.lowStock
                      ? 'bg-warning/[0.07] hover:bg-warning/[0.12]'
                      : undefined
                }
              >
                <TableCell>
                  <div className="font-medium leading-tight">{item.productName}</div>
                  <div className="font-mono text-xs text-muted-foreground">{item.sku}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.brandName ?? '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    {out ? (
                      <Badge variant="destructive">
                        <AlertTriangle aria-hidden="true" />
                        Out
                      </Badge>
                    ) : item.lowStock ? (
                      <Badge variant="warning">
                        <AlertTriangle aria-hidden="true" />
                        Low
                      </Badge>
                    ) : null}
                    <span
                      className={cn(
                        'font-mono tabular text-base font-semibold',
                        out ? 'text-destructive' : 'text-foreground',
                      )}
                    >
                      {item.onHand}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular text-sm text-muted-foreground">
                  {item.reorderLevel}
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {item.rackLocation ?? '—'}
                </TableCell>
                <TableCell className="text-right font-mono tabular tracking-tight">
                  {formatCurrency(item.sellingPrice)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAdjust(item)}
                      aria-label={`Adjust stock for ${item.sku}`}
                    >
                      Adjust
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewLedger(item)}
                      aria-label={`View movements for ${item.sku}`}
                    >
                      Ledger
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
