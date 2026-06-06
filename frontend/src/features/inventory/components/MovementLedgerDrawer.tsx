import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/shared/ui/sheet';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { Badge } from '@/shared/ui/badge';
import { useMovements } from '../hooks/useInventory';
import { formatDate } from '@/shared/lib/dates';
import type { InventoryItem } from '../types';
import { cn } from '@/shared/lib/cn';

interface MovementLedgerDrawerProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MOVEMENT_LABELS: Record<string, string> = {
  OPENING: 'Opening',
  SALE: 'Sale',
  SALE_RETURN: 'Return',
  ADJUSTMENT: 'Adjustment',
  PURCHASE: 'Purchase',
  TRANSFER: 'Transfer',
  DAMAGE: 'Damage',
};

export function MovementLedgerDrawer({ item, open, onOpenChange }: MovementLedgerDrawerProps) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useMovements(item?.variantId ?? '', page, open && !!item);

  const movements = data?.items ?? [];
  const meta = data?.meta;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg overflow-hidden">
        <SheetHeader className="shrink-0">
          <SheetTitle>Movement Ledger</SheetTitle>
          {item && (
            <SheetDescription>
              {item.productName} · {item.sku}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No movements yet.</p>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start justify-between rounded-md border px-4 py-3 text-sm"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={m.quantityDelta >= 0 ? 'outline' : 'destructive'}
                        className="text-xs"
                      >
                        {MOVEMENT_LABELS[m.type] ?? m.type}
                      </Badge>
                      <span
                        className={cn(
                          'font-semibold',
                          m.quantityDelta > 0
                            ? 'text-green-600'
                            : m.quantityDelta < 0
                              ? 'text-destructive'
                              : '',
                        )}
                      >
                        {m.quantityDelta > 0 ? '+' : ''}
                        {m.quantityDelta}
                      </span>
                      <span className="text-muted-foreground">→ {m.balanceAfter}</span>
                    </div>
                    {m.note && <p className="text-xs text-muted-foreground">{m.note}</p>}
                    <p className="text-xs text-muted-foreground">{formatDate(m.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex shrink-0 items-center justify-between border-t pt-4 text-sm text-muted-foreground">
            <span>
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
      </SheetContent>
    </Sheet>
  );
}
