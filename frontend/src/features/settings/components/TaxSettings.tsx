import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { toast } from '@/shared/ui/use-toast';
import { useUpdateSettings } from '../hooks/useSettings';
import type { Settings } from '../types';

const taxSchema = z.object({
  default_pct: z
    .number({ invalid_type_error: 'Must be a number' })
    .min(0, 'Minimum is 0%')
    .max(100, 'Maximum is 100%'),
});

type TaxFormValues = z.infer<typeof taxSchema>;

export function TaxSettings({ settings }: { settings: Settings }) {
  const updateMutation = useUpdateSettings();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaxFormValues>({
    resolver: zodResolver(taxSchema),
    defaultValues: { default_pct: 18 },
  });

  useEffect(() => {
    reset({ default_pct: settings.tax?.default_pct ?? 18 });
  }, [settings, reset]);

  async function onSubmit(values: TaxFormValues) {
    try {
      await updateMutation.mutateAsync({ tax: { default_pct: values.default_pct } });
      toast({ title: 'Tax settings saved', variant: 'success' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="tax-pct">Default Tax Rate (%)</Label>
        <Input
          id="tax-pct"
          type="number"
          step="0.01"
          {...register('default_pct', { valueAsNumber: true })}
          aria-invalid={!!errors.default_pct}
          className="w-32 font-mono"
        />
        {errors.default_pct && (
          <p className="text-xs text-destructive">{errors.default_pct.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save Tax Settings'}
      </Button>
    </form>
  );
}
