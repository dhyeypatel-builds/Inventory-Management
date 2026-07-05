import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { AlertTriangle, Check, Copy, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { toast } from '@/shared/ui/use-toast';
import { copyToClipboard } from '@/shared/lib/clipboard';
import { useProvisionTenant } from '../hooks/useTenants';
import type { ProvisionResult } from '../types';

const schema = z.object({
  name: z.string().min(1, 'Shop name required').max(120),
  slug: z
    .string()
    .min(1, 'Slug required')
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes only'),
  ownerName: z.string().min(1, 'Owner name required').max(120),
  ownerEmail: z.string().email('Enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function InviteLink({ result }: { result: ProvisionResult }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${result.invite.path}`;

  const copy = async (): Promise<void> => {
    if (await copyToClipboard(link)) {
      setCopied(true);
      toast({ title: 'Invite link copied', variant: 'success' });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({ title: 'Could not copy', description: 'Copy the link manually.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-sm border border-success/25 bg-success/10 px-3.5 py-3 text-sm text-[oklch(0.45_0.13_150)]">
        <Check aria-hidden className="mt-px h-4 w-4 shrink-0" />
        <span>
          <strong className="font-semibold">{result.tenant.name}</strong> is provisioned. Send the
          owner this one-time invite link to set up their sign-in.
        </span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-link">Invite link for {result.owner.email}</Label>
        <div className="flex gap-2">
          <Input id="invite-link" readOnly value={link} className="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" aria-label="Copy invite link" onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Expires {new Date(result.invite.expiresAt).toLocaleDateString('en-GB')}. The owner stays
          passwordless until they accept it.
        </p>
      </div>
    </div>
  );
}

export function ProvisionTenantDialog() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const provision = useProvisionTenant();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const close = (next: boolean): void => {
    setOpen(next);
    if (!next) {
      // Reset after the close animation so the form doesn't flash empty.
      setTimeout(() => {
        reset();
        setResult(null);
        setServerError(null);
        setSlugTouched(false);
      }, 150);
    }
  };

  const onSubmit = async (values: FormValues): Promise<void> => {
    setServerError(null);
    try {
      const res = await provision.mutateAsync(values);
      setResult(res);
    } catch (err) {
      const msg = isAxiosError(err)
        ? (err.response?.data?.error?.message as string | undefined)
        : undefined;
      setServerError(msg ?? 'Could not provision the shop. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Provision shop
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{result ? 'Shop provisioned' : 'Provision a new shop'}</DialogTitle>
          <DialogDescription>
            {result
              ? 'Share the invite link below with the shop owner.'
              : 'Creates an isolated tenant with a passwordless owner account and starter data.'}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <>
            <InviteLink result={result} />
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Shop name</Label>
              <Input
                id="name"
                placeholder="Acme Tyres"
                aria-invalid={!!errors.name}
                {...register('name', {
                  onChange: (e) => {
                    if (!slugTouched) setValue('slug', slugify(e.target.value));
                  },
                })}
              />
              {errors.name && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                placeholder="acme-tyres"
                aria-invalid={!!errors.slug}
                className="font-mono text-sm"
                {...register('slug', { onChange: () => setSlugTouched(true) })}
              />
              {errors.slug && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.slug.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ownerName">Owner name</Label>
                <Input
                  id="ownerName"
                  placeholder="Jane Smith"
                  aria-invalid={!!errors.ownerName}
                  {...register('ownerName')}
                />
                {errors.ownerName && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.ownerName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ownerEmail">Owner email</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  placeholder="jane@acmetyres.co.uk"
                  aria-invalid={!!errors.ownerEmail}
                  {...register('ownerEmail')}
                />
                {errors.ownerEmail && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.ownerEmail.message}
                  </p>
                )}
              </div>
            </div>

            {serverError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-sm border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-[oklch(0.48_0.2_27)]"
              >
                <AlertTriangle aria-hidden className="mt-px h-4 w-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={provision.isPending}>
                {provision.isPending ? 'Provisioning…' : 'Provision shop'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
