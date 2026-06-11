import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { api } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { toast } from '@/shared/ui/use-toast';

const ENTITIES = [
  { value: 'customers', label: 'Customers' },
  { value: 'products', label: 'Products' },
  { value: 'sales', label: 'Sales' },
  { value: 'inventory', label: 'Inventory' },
] as const;

type Entity = (typeof ENTITIES)[number]['value'];

async function downloadExport(entity: Entity): Promise<void> {
  const res = await api.get(`/exports/${entity}`, { responseType: 'blob' });
  const blob = new Blob([res.data as BlobPart], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${entity}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Raw CSV export of the shop's own data (backup / migration / GDPR). */
export function ExportDataCard() {
  const [busy, setBusy] = useState<Entity | null>(null);

  async function onExport(entity: Entity) {
    setBusy(entity);
    try {
      await downloadExport(entity);
    } catch {
      toast({ title: 'Export failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Download your shop's raw data as CSV files — yours to keep, back up, or
        move elsewhere.
      </p>
      <div className="flex flex-wrap gap-2">
        {ENTITIES.map(({ value, label }) => (
          <Button
            key={value}
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => onExport(value)}
          >
            {busy === value ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
