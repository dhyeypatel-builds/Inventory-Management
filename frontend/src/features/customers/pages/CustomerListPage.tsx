import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { Plus, Search } from 'lucide-react';
import { Toaster } from '@/shared/ui/toaster';
import { toast } from '@/shared/ui/use-toast';
import { useCustomers, useDeleteCustomer } from '../hooks/useCustomers';
import { CustomerTable } from '../components/CustomerTable';
import { CustomerForm } from '../components/CustomerForm';
import type { Customer } from '../types';

export function CustomerListPage() {
  const [q, setQ] = useState('');
  const [page] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const { data, isLoading, isError } = useCustomers({ q: q || undefined, page, pageSize: 20 });
  const deleteMutation = useDeleteCustomer();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setFormOpen(true);
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`Delete customer "${customer.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(customer.id);
      toast({ title: 'Customer deleted', variant: 'success' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Customer register
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Customer
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by name or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search customers"
          />
        </div>
      </div>

      {isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load customers. Please refresh.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <CustomerTable
          customers={data?.customers ?? []}
          isLoading={false}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {data?.meta && (
        <p className="font-mono text-xs text-muted-foreground">
          {data.meta.total} customer{data.meta.total !== 1 ? 's' : ''}
        </p>
      )}

      <CustomerForm
        customer={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      <Toaster />
    </div>
  );
}
