import { TrendingUp, Boxes, Package, AlertTriangle, PoundSterling } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { formatCurrency } from '@/shared/lib/currency';
import { KpiCard } from '../components/KpiCard';
import { RevenueBarChart } from '../components/RevenueBarChart';
import { SalesTrendChart } from '../components/SalesTrendChart';
import { TopBrandsList } from '../components/TopBrandsList';
import { LowStockList } from '../components/LowStockList';
import { useSummary, useSalesTrend, useTopBrands, useLowStockItems } from '../hooks/useDashboard';

export function DashboardPage() {
  const summary = useSummary();
  const trend = useSalesTrend(30);
  const topBrands = useTopBrands(5);
  const lowStock = useLowStockItems(8);

  const s = summary.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Shop overview
          </p>
        </div>
      </div>

      {summary.isError && (
        <div className="flex items-center gap-3 rounded-sm border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-[oklch(0.48_0.2_27)]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Could not load dashboard data.</span>
          <Button size="sm" variant="outline" onClick={() => summary.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Today's Revenue"
          value={s ? formatCurrency(s.today.revenue) : '—'}
          subtitle={s ? `${s.today.salesCount} sales` : undefined}
          icon={PoundSterling}
          loading={summary.isLoading}
          accent
        />
        <KpiCard
          title="MTD Revenue"
          value={s ? formatCurrency(s.mtd.revenue) : '—'}
          subtitle={s ? `${s.mtd.salesCount} sales` : undefined}
          icon={TrendingUp}
          loading={summary.isLoading}
        />
        <KpiCard
          title="Total SKUs"
          value={s ? String(s.totalSkus) : '—'}
          subtitle="Active variants"
          icon={Package}
          loading={summary.isLoading}
        />
        <KpiCard
          title="Stock Value"
          value={s ? formatCurrency(s.stockValue) : '—'}
          subtitle="At purchase price"
          icon={Boxes}
          loading={summary.isLoading}
        />
      </div>

      {s && s.openAlerts > 0 && (
        <div className="flex items-center gap-2 rounded-sm border border-warning/35 bg-warning/15 px-4 py-2.5 text-sm font-medium text-[oklch(0.46_0.13_64)]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {s.openAlerts} open stock alert{s.openAlerts !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Charts (left) + action lists (right) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <RevenueBarChart />
          <SalesTrendChart data={trend.data} loading={trend.isLoading} error={trend.isError} />
        </div>
        <div className="space-y-4">
          <LowStockList data={lowStock.data} loading={lowStock.isLoading} />
          <TopBrandsList data={topBrands.data} loading={topBrands.isLoading} />
        </div>
      </div>
    </div>
  );
}
