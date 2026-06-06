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

const reorderSchema = z.object({
  default_reorder_level: z
    .number({ invalid_type_error: 'Must be a whole number' })
    .int('Must be a whole number')
    .min(0, 'Minimum is 0'),
});

type ReorderFormValues = z.infer<typeof reorderSchema>;

export function ReorderSettings({ settings }: { settings: Settings }) {
  const updateMutation = useUpdateSettings();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReorderFormValues>({
    resolver: zodResolver(reorderSchema),
    defaultValues: { default_reorder_level: 5 },
  });

  useEffect(() => {
    reset({ default_reorder_level: settings.inventory?.default_reorder_level ?? 5 });
  }, [settings, reset]);

  async function onSubmit(values: ReorderFormValues) {
    try {
      await updateMutation.mutateAsync({
        inventory: { default_reorder_level: values.default_reorder_level },
      });
      toast({ title: 'Reorder settings saved', variant: 'success' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reorder-level">Default Reorder Level</Label>
        <Input
          id="reorder-level"
          type="number"
          step="1"
          {...register('default_reorder_level', { valueAsNumber: true })}
          aria-invalid={!!errors.default_reorder_level}
          className="w-32 font-mono"
        />
        {errors.default_reorder_level && (
          <p className="text-xs text-destructive">{errors.default_reorder_level.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          New variants will inherit this as their default reorder threshold.
        </p>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save Reorder Settings'}
      </Button>
    </form>
  );
}
