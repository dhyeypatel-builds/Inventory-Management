import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { formatCurrency } from '@/shared/lib/currency';
import type { TopBrand } from '../types';

interface TopBrandsListProps {
  data?: TopBrand[];
  loading?: boolean;
}

export function TopBrandsList({ data, loading }: TopBrandsListProps) {
  const max = data && data.length > 0 ? Math.max(...data.map((b) => b.revenue)) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Brands</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3.5">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
        {!loading && (!data || data.length === 0) && (
          <p className="text-sm text-muted-foreground">No sales data yet.</p>
        )}
        {!loading &&
          data?.map((brand, i) => (
            <div key={brand.brandId ?? brand.brandName} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-sm bg-surface-2 font-mono text-[0.65rem] font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="truncate font-medium">{brand.brandName}</span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-mono tabular text-xs text-muted-foreground">
                    {brand.units}u
                  </span>
                  <span className="ml-2 font-mono tabular text-sm font-semibold">
                    {formatCurrency(brand.revenue)}
                  </span>
                </div>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: max > 0 ? `${Math.max(4, (brand.revenue / max) * 100)}%` : '0%' }}
                />
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
