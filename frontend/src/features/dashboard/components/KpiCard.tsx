import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { type LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  loading?: boolean;
  /** Tints the value + icon amber. Reserve for the single headline metric. */
  accent?: boolean;
}

export function KpiCard({ title, value, subtitle, icon: Icon, loading, accent }: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden">
      {accent && (
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
      )}
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </span>
          <span
            className={
              accent
                ? 'grid h-7 w-7 place-items-center rounded-sm bg-primary/12 text-primary'
                : 'grid h-7 w-7 place-items-center rounded-sm bg-surface-2 text-muted-foreground'
            }
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        {loading ? (
          <>
            <Skeleton className="mb-1 h-8 w-32" />
            <Skeleton className="h-3.5 w-20" />
          </>
        ) : (
          <div className="space-y-1">
            <div className="font-mono text-3xl font-bold tabular tracking-tight text-foreground">
              {value}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
