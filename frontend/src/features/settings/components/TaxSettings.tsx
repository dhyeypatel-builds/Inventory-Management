import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Checkbox } from '@/shared/ui/checkbox';
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
  // Defaults to registered (matches the server) unless explicitly turned off.
  const [vatRegistered, setVatRegistered] = useState(settings.tax?.vat_registered !== false);

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
    setVatRegistered(settings.tax?.vat_registered !== false);
  }, [settings, reset]);

  async function onSubmit(values: TaxFormValues) {
    try {
      await updateMutation.mutateAsync({
        tax: { default_pct: values.default_pct, vat_registered: vatRegistered },
      });
      toast({ title: 'Tax settings saved', variant: 'success' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex items-start gap-3 rounded-sm border border-border bg-surface-2 p-3">
        <Checkbox
          id="vat-registered"
          checked={vatRegistered}
          onCheckedChange={(c) => setVatRegistered(c === true)}
          className="mt-0.5"
        />
        <div className="space-y-0.5">
          <Label htmlFor="vat-registered" className="cursor-pointer">
            Registered for VAT
          </Label>
          <p className="text-xs text-muted-foreground">
            When off, sales charge no VAT and invoices are titled “Invoice” instead of “Tax
            Invoice”. Leave on only if you have a VAT registration number.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tax-pct">Default Tax Rate (%)</Label>
        <Input
          id="tax-pct"
          type="number"
          step="0.01"
          disabled={!vatRegistered}
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
