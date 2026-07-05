import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ImagePlus, Loader2, Store } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { AuthedImage } from '@/shared/ui/authed-image';
import { toast } from '@/shared/ui/use-toast';
import { uploadLogo } from '@/features/onboarding/api/onboarding.api';
import { useUpdateSettings } from '../hooks/useSettings';
import type { Settings } from '../types';

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(160),
  phone: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('Enter a valid email address').max(160).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  vat_number: z.string().max(20).optional().or(z.literal('')),
});

type CompanyFormValues = z.infer<typeof companySchema>;

export function CompanyForm({ settings }: { settings: Settings }) {
  const updateMutation = useUpdateSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(settings.company?.logo_url ?? '');
  const [uploading, setUploading] = useState(false);

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadLogo(file);
      await updateMutation.mutateAsync({ company: { logo_url: url } });
      setLogoUrl(url);
      toast({ title: 'Logo updated', variant: 'success' });
    } catch {
      toast({ title: 'Logo upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: '', phone: '', email: '', address: '', vat_number: '' },
  });

  useEffect(() => {
    reset({
      name: settings.company?.name ?? '',
      phone: settings.company?.phone ?? '',
      email: settings.company?.email ?? '',
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
          email: values.email || undefined,
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
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface-2">
          {logoUrl ? (
            <AuthedImage src={logoUrl} alt="Shop logo" className="h-full w-full object-cover" />
          ) : (
            <Store className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onPickLogo}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {logoUrl ? 'Replace logo' : 'Upload logo'}
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Shown on branded PDF reports. PNG, JPEG or WebP, up to 2 MB.
          </p>
        </div>
      </div>

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
        <Label htmlFor="company-email">Contact Email</Label>
        <Input
          id="company-email"
          type="email"
          inputMode="email"
          placeholder="shop@example.com"
          {...register('email')}
          aria-invalid={!!errors.email}
        />
        {errors.email ? (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Where customer replies to invoice emails are sent.
          </p>
        )}
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
