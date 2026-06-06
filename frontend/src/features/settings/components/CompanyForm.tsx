import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { toast } from '@/shared/ui/use-toast';
import { useUpdateSettings } from '../hooks/useSettings';
import type { Settings } from '../types';

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(160),
  phone: z.string().max(20).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  vat_number: z.string().max(20).optional().or(z.literal('')),
});

type CompanyFormValues = z.infer<typeof companySchema>;

export function CompanyForm({ settings }: { settings: Settings }) {
  const updateMutation = useUpdateSettings();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: '', phone: '', address: '', vat_number: '' },
  });

  useEffect(() => {
    reset({
      name: settings.company?.name ?? '',
      phone: settings.company?.phone ?? '',
      address: settings.company?.address ?? '',
      vat_number: settings.company?.vat_number ?? '',
    });
  }, [settings, reset]);

  async function onSubmit(values: CompanyFormValues) {
    try {
      await updateMutation.mutateAsync({
        company: {
          name: values.name,
          phone: values.phone || undefined,
          address: values.address || undefined,
          vat_number: values.vat_number || undefined,
        },
      });
      toast({ title: 'Company settings saved', variant: 'success' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="company-name">Company Name *</Label>
        <Input
          id="company-name"
          placeholder="TyreStock Auto"
          {...register('name')}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="company-phone">Phone</Label>
          <Input
            id="company-phone"
            placeholder="+44 7911 123456"
            className="font-mono"
            {...register('phone')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company-vat">VAT Number</Label>
          <Input
            id="company-vat"
            placeholder="GB123456789"
            className="font-mono"
            {...register('vat_number')}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="company-address">Address</Label>
        <Textarea
          id="company-address"
          placeholder="Full address"
          rows={3}
          {...register('address')}
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save Company Settings'}
      </Button>
    </form>
  );
}
