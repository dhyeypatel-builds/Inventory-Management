import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { useAdjustStock } from '../hooks/useInventory';
import { toast } from '@/shared/ui/use-toast';
import type { InventoryItem } from '../types';

const adjustSchema = z.object({
  delta: z.number({ invalid_type_error: 'Enter a number' }).int('Must be a whole number').refine(
    (n) => n !== 0,
    { message: 'Delta cannot be zero' },
  ),
  reason: z.string().min(1, 'Reason is required').max(200),
  note: z.string().max(500).optional(),
});

type AdjustFormValues = z.infer<typeof adjustSchema>;

interface AdjustStockDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdjustStockDialog({ item, open, onOpenChange }: AdjustStockDialogProps) {
  const adjust = useAdjustStock();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { delta: 0, reason: '', note: '' },
  });

  useEffect(() => {
    if (open) reset({ delta: 0, reason: '', note: '' });
  }, [open, reset]);

  async function onSubmit(values: AdjustFormValues) {
    if (!item) return;
    try {
      await adjust.mutateAsync({ variantId: item.variantId, data: values });
      toast({ title: 'Stock adjusted', variant: 'success' });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
          : undefined;
      toast({
        title: 'Adjustment failed',
        description: msg ?? 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          {item && (
            <DialogDescription>
              {item.productName} · {item.sku} · Current on-hand: {item.onHand}
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="delta">
              Delta (positive to add, negative to deduct)
            </Label>
            <Input
              id="delta"
              type="number"
              step="1"
              {...register('delta', { valueAsNumber: true })}
              aria-invalid={!!errors.delta}
            />
            {errors.delta && (
              <p className="text-xs text-destructive">{errors.delta.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              placeholder="e.g. Purchase, Damage, Count correction"
              {...register('reason')}
              aria-invalid={!!errors.reason}
            />
            {errors.reason && (
              <p className="text-xs text-destructive">{errors.reason.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              placeholder="Additional details…"
              rows={2}
              {...register('note')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
