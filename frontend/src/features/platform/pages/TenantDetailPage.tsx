import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ExternalLink, Pause, Play } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { toast } from '@/shared/ui/use-toast';
import { formatDate } from '@/shared/lib/dates';
import {
  useTenant,
  useSuspendTenant,
  useReactivateTenant,
  useImpersonateTenant,
} from '../hooks/useTenants';
import { startImpersonation } from '../lib/impersonation';

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tabular tracking-tight">{value}</div>
    </div>
  );
}

export function TenantDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: tenant, isLoading, isError } = useTenant(id);
  const suspend = useSuspendTenant();
  const reactivate = useReactivateTenant();
  const impersonate = useImpersonateTenant();
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  const onSuspend = async (): Promise<void> => {
    try {
      await suspend.mutateAsync(id);
      toast({ title: 'Shop suspended', description: 'Active sessions were ended.', variant: 'success' });
      setConfirmSuspend(false);
    } catch {
      toast({ title: 'Could not suspend the shop', variant: 'destructive' });
    }
  };

  const onReactivate = async (): Promise<void> => {
    try {
      await reactivate.mutateAsync(id);
      toast({ title: 'Shop reactivated', variant: 'success' });
    } catch {
      toast({ title: 'Could not reactivate the shop', variant: 'destructive' });
    }
  };

  const onImpersonate = async (): Promise<void> => {
    try {
      const result = await impersonate.mutateAsync(id);
      startImpersonation(result); // hard-navigates into the tenant app
    } catch {
      toast({ title: 'Could not open the shop', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !tenant) {
    return (
      <div className="space-y-4">
        <Link to="/admin/tenants" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to shops
        </Link>
        <p className="text-sm text-destructive">This shop could not be loaded.</p>
      </div>
    );
  }

  const isActive = tenant.status === 'ACTIVE';

  return (
    <div className="space-y-7">
      <button
        type="button"
        onClick={() => navigate('/admin/tenants')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to shops
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
            <Badge variant={isActive ? 'success' : 'destructive'}>
              {isActive ? 'Active' : 'Suspended'}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{tenant.slug}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onImpersonate} disabled={impersonate.isPending || !isActive}>
            <ExternalLink className="h-4 w-4" />
            {impersonate.isPending ? 'Opening…' : 'Open as this shop'}
          </Button>
          {isActive ? (
            <Button variant="destructive" onClick={() => setConfirmSuspend(true)}>
              <Pause className="h-4 w-4" />
              Suspend
            </Button>
          ) : (
            <Button onClick={onReactivate} disabled={reactivate.isPending}>
              <Play className="h-4 w-4" />
              {reactivate.isPending ? 'Reactivating…' : 'Reactivate'}
            </Button>
          )}
        </div>
      </div>

      {/* Usage metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric label="SKUs" value={tenant.skuCount} />
        <Metric label="Customers" value={tenant.customerCount} />
        <Metric label="Sales · 30d" value={tenant.sales30d} />
        <Metric
          label="Last sale"
          value={
            tenant.lastSaleAt ? (
              <span className="text-base">{formatDate(tenant.lastSaleAt)}</span>
            ) : (
              <span className="text-base text-muted-foreground">None yet</span>
            )
          }
        />
      </div>

      {/* Meta */}
      <dl className="grid gap-x-8 gap-y-3 rounded-sm border border-border bg-card p-5 sm:grid-cols-2">
        <div className="flex justify-between gap-4 border-b border-border/60 pb-3 sm:border-0 sm:pb-0">
          <dt className="text-sm text-muted-foreground">Plan</dt>
          <dd className="text-sm font-medium capitalize">{tenant.plan}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-border/60 pb-3 sm:border-0 sm:pb-0">
          <dt className="text-sm text-muted-foreground">Created</dt>
          <dd className="text-sm font-medium">{formatDate(tenant.createdAt)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-sm text-muted-foreground">Onboarding</dt>
          <dd className="text-sm font-medium">
            {tenant.onboardingCompletedAt ? formatDate(tenant.onboardingCompletedAt) : 'Pending'}
          </dd>
        </div>
      </dl>

      {/* Suspend confirmation */}
      <Dialog open={confirmSuspend} onOpenChange={setConfirmSuspend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {tenant.name}?</DialogTitle>
            <DialogDescription>
              The shop's users are signed out immediately and blocked from logging in until you
              reactivate. Their data is preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSuspend(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onSuspend} disabled={suspend.isPending}>
              {suspend.isPending ? 'Suspending…' : 'Suspend shop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
