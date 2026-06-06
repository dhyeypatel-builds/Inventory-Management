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
import { toast } from '@/shared/ui/use-toast';
import { useCreateCustomer, useUpdateCustomer } from '../hooks/useCustomers';
import type { Customer } from '../types';

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  phone: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  vatNumber: z
    .string()
    .regex(/^GB[0-9]{9}([0-9]{3})?$/, 'Invalid VAT number (e.g. GB123456789)')
    .optional()
    .or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  vehicleNo: z.string().max(20).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerFormProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerForm({ customer, open, onOpenChange }: CustomerFormProps) {
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const isEdit = !!customer;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      vatNumber: '',
      address: '',
      vehicleNo: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: customer?.name ?? '',
        phone: customer?.phone ?? '',
        email: customer?.email ?? '',
        vatNumber: customer?.vatNumber ?? '',
        address: customer?.address ?? '',
        vehicleNo: customer?.vehicleNo ?? '',
        notes: customer?.notes ?? '',
      });
    }
  }, [open, customer, reset]);

  async function onSubmit(values: CustomerFormValues) {
    const payload = {
      name: values.name,
      phone: values.phone || undefined,
      email: values.email || undefined,
      vatNumber: values.vatNumber || undefined,
      address: values.address || undefined,
      vehicleNo: values.vehicleNo || undefined,
      notes: values.notes || undefined,
    };

    try {
      if (isEdit && customer) {
        await updateMutation.mutateAsync({ id: customer.id, data: payload });
        toast({ title: 'Customer updated', variant: 'success' });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: 'Customer created', variant: 'success' });
      }
      onOpenChange(false);
    } catch {
      toast({
        title: isEdit ? 'Update failed' : 'Create failed',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Customer' : 'New Customer'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update customer details.' : 'Add a new customer.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cust-name">Name *</Label>
            <Input
              id="cust-name"
              placeholder="Customer name"
              {...register('name')}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cust-phone">Phone</Label>
              <Input
                id="cust-phone"
                placeholder="+91 98765 43210"
                {...register('phone')}
                aria-invalid={!!errors.phone}
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cust-email">Email</Label>
              <Input
                id="cust-email"
                type="email"
                placeholder="customer@example.com"
                {...register('email')}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cust-vatNumber">VAT Number</Label>
              <Input
                id="cust-vatNumber"
                placeholder="GB123456789"
                {...register('vatNumber')}
                aria-invalid={!!errors.vatNumber}
              />
              {errors.vatNumber && (
                <p className="text-xs text-destructive">{errors.vatNumber.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cust-vehicleNo">Vehicle No.</Label>
              <Input
                id="cust-vehicleNo"
                placeholder="GJ01AB1234"
                {...register('vehicleNo')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cust-address">Address</Label>
            <Textarea
              id="cust-address"
              placeholder="Full address"
              rows={2}
              {...register('address')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cust-notes">Notes</Label>
            <Textarea
              id="cust-notes"
              placeholder="Any additional notes"
              rows={2}
              {...register('notes')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
