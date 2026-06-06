import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useCustomer } from '../hooks/useCustomers';
import { PurchaseHistory } from '../components/PurchaseHistory';
import { CustomerForm } from '../components/CustomerForm';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const { data: customer, isLoading, isError } = useCustomer(id ?? '');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/customers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Customers
        </Button>
        <p className="text-sm text-destructive">Customer not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/customers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Customers
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      <div className="grid gap-4 rounded-md border p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Phone</p>
          <p>{customer.phone ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Email</p>
          <p>{customer.email ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">VAT No.</p>
          <p>{customer.vatNumber ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Vehicle No.</p>
          <p>{customer.vehicleNo ?? '—'}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-muted-foreground">Address</p>
          <p>{customer.address ?? '—'}</p>
        </div>
        {customer.notes && (
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-xs text-muted-foreground">Notes</p>
            <p>{customer.notes}</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Purchase History</h2>
        <PurchaseHistory sales={customer.recentSales} />
      </div>

      <CustomerForm
        customer={customer}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
