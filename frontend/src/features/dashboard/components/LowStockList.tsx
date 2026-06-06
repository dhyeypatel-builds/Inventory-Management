import { AlertTriangle, PackageX, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Badge } from '@/shared/ui/badge';
import type { LowStockItem } from '../api/inventory.api';

interface LowStockListProps {
  data?: LowStockItem[];
  loading?: boolean;
}

export function LowStockList({ data, loading }: LowStockListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Low Stock</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
        {!loading && (!data || data.length === 0) && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-[oklch(0.45_0.13_150)]" />
            All stock levels are healthy.
          </p>
        )}
        {!loading &&
          data?.map((item) => (
            <div key={item.variantId} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.productName}</p>
                <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
              </div>
              <Badge
                variant={item.onHand === 0 ? 'destructive' : 'warning'}
                className="ml-2 shrink-0"
              >
                {item.onHand === 0 ? <PackageX /> : <AlertTriangle />}
                {item.onHand === 0 ? 'Out' : `${item.onHand} left`}
              </Badge>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
