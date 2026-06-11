import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Search, Truck } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState } from '@/shared/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { toast } from '@/shared/ui/use-toast';
import { listVendors, updateVendor } from '../api/purchases.api';
import type { Vendor } from '../types';

/** Vendor book: list, search, and edit supplier details (fixes typo-duplicates). */
export function VendorsManager() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', { q: search, page }],
    queryFn: () => listVendors({ q: search || undefined, page, pageSize: 20 }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Vendor> }) => updateVendor(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  async function onSave(form: FormData) {
    if (!editing) return;
    const patch = {
      name: String(form.get('name') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim() || null,
      email: String(form.get('email') ?? '').trim() || null,
      vatNumber: String(form.get('vatNumber') ?? '').trim() || null,
      address: String(form.get('address') ?? '').trim() || null,
    };
    if (!patch.name) {
      toast({ title: 'Vendor name is required', variant: 'destructive' });
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: editing.id, patch });
      setEditing(null);
      toast({ title: 'Vendor updated', variant: 'success' });
    } catch {
      toast({ title: 'Failed to update vendor', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search vendors…"
          className="pl-8"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : items.length === 0 && !search ? (
        <EmptyState
          icon={Truck}
          title="No vendors yet"
          description="Vendors are created automatically the first time you receive stock from them."
        />
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No vendors match that search.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="whitespace-nowrap">VAT No.</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-medium">{vendor.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{vendor.phone ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{vendor.email ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{vendor.vatNumber ?? '—'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(vendor)}
                      aria-label={`Edit ${vendor.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit vendor</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void onSave(new FormData(e.currentTarget));
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="vendor-name">Name *</Label>
                <Input id="vendor-name" name="name" defaultValue={editing.name} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="vendor-phone">Phone</Label>
                  <Input id="vendor-phone" name="phone" defaultValue={editing.phone ?? ''} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vendor-vat">VAT No.</Label>
                  <Input id="vendor-vat" name="vatNumber" defaultValue={editing.vatNumber ?? ''} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vendor-email">Email</Label>
                <Input id="vendor-email" name="email" type="email" defaultValue={editing.email ?? ''} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vendor-address">Address</Label>
                <Input id="vendor-address" name="address" defaultValue={editing.address ?? ''} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
