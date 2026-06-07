import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, Trash2 } from 'lucide-react';
import { api } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { toast } from '@/shared/ui/use-toast';

/** Load or clear the per-tenant sample dataset (ON-03). */
export function DemoDataCard() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<'load' | 'clear' | null>(null);

  const load = async (): Promise<void> => {
    setBusy('load');
    try {
      const res = await api.post<{ data: { seeded: boolean; products: number } }>('/onboarding/demo-seed', {});
      toast({
        title: res.data.data.seeded ? `Added ${res.data.data.products} sample tyres` : 'Sample data already loaded',
        variant: 'success',
      });
      await qc.invalidateQueries();
    } catch {
      toast({ title: 'Could not load sample data', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const clear = async (): Promise<void> => {
    setBusy('clear');
    try {
      const res = await api.post<{ data: { products: number } }>('/onboarding/demo-seed/clear', {});
      toast({ title: `Cleared ${res.data.data.products} sample tyres`, variant: 'success' });
      await qc.invalidateQueries();
    } catch {
      toast({ title: 'Could not clear sample data', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Load a small set of sample tyres and customers to explore the app, then clear them whenever
        you like. Clearing only removes the sample rows — your own data is untouched.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={load} disabled={busy !== null}>
          <Sparkles className="h-4 w-4" />
          {busy === 'load' ? 'Loading…' : 'Load sample data'}
        </Button>
        <Button variant="outline" onClick={clear} disabled={busy !== null}>
          <Trash2 className="h-4 w-4" />
          {busy === 'clear' ? 'Clearing…' : 'Clear sample data'}
        </Button>
      </div>
    </div>
  );
}
