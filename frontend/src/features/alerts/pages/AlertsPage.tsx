import { useState } from 'react';
import { Toaster } from '@/shared/ui/toaster';
import { useAlerts } from '../hooks/useAlerts';
import { AlertList } from '../components/AlertList';
import type { AlertStatus } from '../types';

const STATUS_OPTIONS: { label: string; value: AlertStatus | '' }[] = [
  { label: 'Open', value: 'OPEN' },
  { label: 'Acknowledged', value: 'ACKNOWLEDGED' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'All', value: '' },
];

export function AlertsPage() {
  const [status, setStatus] = useState<AlertStatus | ''>('OPEN');

  const { data, isLoading, isError } = useAlerts({
    status: status || undefined,
    pageSize: 50,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock Alerts</h1>
        <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Reorder watch
        </p>
      </div>

      <div className="flex gap-2" role="group" aria-label="Filter alerts by status">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatus(opt.value)}
            aria-pressed={status === opt.value}
            className={
              status === opt.value
                ? 'rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
                : 'rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load alerts. Please refresh.
        </div>
      )}

      <AlertList alerts={data?.items ?? []} isLoading={isLoading} />

      {data?.meta && (
        <p className="font-mono text-xs text-muted-foreground">
          {data.meta.total} alert{data.meta.total !== 1 ? 's' : ''}
        </p>
      )}

      <Toaster />
    </div>
  );
}
