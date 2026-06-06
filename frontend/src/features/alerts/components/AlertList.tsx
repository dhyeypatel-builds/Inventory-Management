import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import { formatDateTime } from '@/shared/lib/dates';
import { toast } from '@/shared/ui/use-toast';
import { useAcknowledgeAlert } from '../hooks/useAlerts';
import type { AlertItem } from '../types';

const TYPE_VARIANT: Record<string, 'destructive' | 'warning'> = {
  OUT_OF_STOCK: 'destructive',
  LOW_STOCK: 'warning',
};

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'secondary'> = {
  OPEN: 'default',
  ACKNOWLEDGED: 'secondary',
  RESOLVED: 'outline',
};

interface AlertListProps {
  alerts: AlertItem[];
  isLoading: boolean;
}

export function AlertList({ alerts, isLoading }: AlertListProps) {
  const acknowledge = useAcknowledgeAlert();

  async function handleAcknowledge(id: string) {
    try {
      await acknowledge.mutateAsync(id);
      toast({ title: 'Alert acknowledged', variant: 'success' });
    } catch {
      toast({ title: 'Failed to acknowledge', variant: 'destructive' });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        No alerts found.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Message</TableHead>
            <TableHead className="whitespace-nowrap text-right">Qty / Level</TableHead>
            <TableHead className="whitespace-nowrap">Created</TableHead>
            <TableHead className="w-[120px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={alert.id}>
              <TableCell className="font-medium">
                {alert.productName ?? '—'}
                {alert.brandName && (
                  <span className="ml-1 text-xs text-muted-foreground">({alert.brandName})</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-sm">{alert.sku ?? '—'}</TableCell>
              <TableCell>
                <Badge variant={TYPE_VARIANT[alert.type] ?? 'default'}>
                  {alert.type.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[alert.status] ?? 'default'}>
                  {alert.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{alert.message}</TableCell>
              <TableCell className="text-right font-mono tabular text-sm font-semibold">
                {alert.currentQty} / {alert.threshold}
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                {formatDateTime(alert.createdAt)}
              </TableCell>
              <TableCell>
                {alert.status === 'OPEN' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acknowledge.isPending}
                    onClick={() => handleAcknowledge(alert.id)}
                    aria-label={`Acknowledge alert for ${alert.productName ?? alert.sku}`}
                  >
                    Acknowledge
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
