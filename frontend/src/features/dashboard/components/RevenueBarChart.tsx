import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/currency';
import { useRevenueSeries } from '../hooks/useDashboard';
import type { RevenueInterval } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPeriod(period: string, interval: RevenueInterval): string {
  const [, m, d] = period.split('-');
  const month = MONTHS[Number(m) - 1] ?? m;
  return interval === 'month' ? month : `${Number(d)} ${month}`;
}

/** The headline business chart: revenue per week or month as bars. */
export function RevenueBarChart() {
  const [interval, setInterval] = useState<RevenueInterval>('week');
  const { data, isLoading, isError } = useRevenueSeries(interval, 12);

  const series = (data ?? []).map((p) => ({
    ...p,
    label: formatPeriod(p.period, interval),
  }));
  const hasRevenue = series.some((p) => p.revenue > 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Revenue</CardTitle>
        <div className="flex gap-1" role="group" aria-label="Revenue interval">
          {(['week', 'month'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              onClick={() => setInterval(value)}
              className={cn(
                'rounded-sm border px-2.5 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-wider transition-colors',
                interval === value
                  ? 'border-primary bg-primary/12 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'week' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {isLoading && <Skeleton className="h-64 w-full" />}
        {isError && <p className="text-sm text-muted-foreground">Could not load chart data.</p>}
        {!isLoading && !isError && !hasRevenue && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No sales in this period
          </p>
        )}
        {!isLoading && !isError && hasRevenue && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="2 4"
                  stroke="oklch(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fontFamily: 'JetBrains Mono Variable', fill: 'oklch(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'oklch(var(--border))' }}
                  tickLine={false}
                  minTickGap={12}
                />
                <YAxis
                  tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fontFamily: 'JetBrains Mono Variable', fill: 'oklch(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  cursor={{ fill: 'oklch(var(--muted) / 0.5)' }}
                  contentStyle={{
                    borderRadius: 4,
                    border: '1px solid oklch(var(--border))',
                    boxShadow: '0 12px 32px -8px oklch(0.4 0.02 256 / 0.18)',
                    fontFamily: 'JetBrains Mono Variable',
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) =>
                    name === 'revenue' ? [formatCurrency(value), 'Revenue'] : [value, 'Sales']
                  }
                  labelFormatter={(label: string) =>
                    interval === 'week' ? `Week of ${label}` : label
                  }
                />
                <Bar
                  dataKey="revenue"
                  fill="oklch(var(--primary))"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={42}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
