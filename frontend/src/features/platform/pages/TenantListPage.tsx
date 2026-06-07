import { useState } from 'react';
import { Link } from 'react-router';
import { Search, Store } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import { formatDate } from '@/shared/lib/dates';
import { useTenants } from '../hooks/useTenants';
import { ProvisionTenantDialog } from '../components/ProvisionTenantDialog';
import type { TenantStatus } from '../types';

const FILTERS: { label: string; value: TenantStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Suspended', value: 'SUSPENDED' },
];

export function TenantListPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<TenantStatus | 'ALL'>('ALL');

  const { data: tenants, isLoading, isError } = useTenants({
    q: q.trim() || undefined,
    status: status === 'ALL' ? undefined : status,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shops</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every tenant on the platform, with live usage.
          </p>
        </div>
        <ProvisionTenantDialog />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or slug…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            aria-label="Search shops"
          />
        </div>
        <div className="inline-flex rounded-sm border border-border bg-card p-0.5" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={status === f.value}
              onClick={() => setStatus(f.value)}
              className={
                'rounded-[0.2rem] px-3 py-1.5 text-sm font-medium transition-colors ' +
                (status === f.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground')
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-sm border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shop</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">SKUs</TableHead>
              <TableHead className="text-right">Customers</TableHead>
              <TableHead className="text-right">Sales (30d)</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {isError && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-destructive">
                  Could not load shops. Refresh to try again.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && tenants?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-14 text-center">
                  <Store className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
                  <p className="text-sm font-medium">No shops match your filters.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Provision the first one to get started.
                  </p>
                </TableCell>
              </TableRow>
            )}

            {tenants?.map((t) => (
              <TableRow key={t.id} className="group">
                <TableCell>
                  <Link
                    to={`/admin/tenants/${t.id}`}
                    className="block font-semibold tracking-tight group-hover:text-primary"
                  >
                    {t.name}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">{t.slug}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={t.status === 'ACTIVE' ? 'success' : 'destructive'}>
                    {t.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular">{t.skuCount}</TableCell>
                <TableCell className="text-right tabular">{t.customerCount}</TableCell>
                <TableCell className="text-right tabular">{t.sales30d}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(t.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
