import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { formatCurrency } from '@/shared/lib/currency';
import type { SalesTrendPoint } from '../types';

interface SalesTrendChartProps {
  data?: SalesTrendPoint[];
  loading?: boolean;
  error?: boolean;
}

export function SalesTrendChart({ data, loading, error }: SalesTrendChartProps) {
  return (
    <Card className="col-span-2 flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">Sales Trend (30 days)</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        {loading && <Skeleton className="h-48 w-full" />}
        {error && (
          <p className="text-sm text-muted-foreground">Could not load chart data.</p>
        )}
        {!loading && !error && data && data.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">No sales in this period</p>
        )}
        {!loading && !error && data && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(var(--primary))" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="oklch(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="oklch(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => d.slice(5)}
                tick={{ fontSize: 11, fontFamily: 'JetBrains Mono Variable', fill: 'oklch(var(--muted-foreground))' }}
                axisLine={{ stroke: 'oklch(var(--border))' }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fontFamily: 'JetBrains Mono Variable', fill: 'oklch(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ stroke: 'oklch(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }}
                contentStyle={{
                  borderRadius: 4,
                  border: '1px solid oklch(var(--border))',
                  boxShadow: '0 12px 32px -8px oklch(0.4 0.02 256 / 0.18)',
                  fontFamily: 'JetBrains Mono Variable',
                  fontSize: 12,
                }}
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                labelFormatter={(label: string) => `Date: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="oklch(var(--primary))"
                fill="url(#revenueGradient)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'oklch(var(--primary))', stroke: 'oklch(var(--card))', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
