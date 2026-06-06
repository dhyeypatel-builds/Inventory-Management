import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { Badge } from '@/shared/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from '@/shared/ui/use-toast';
import {
  useSettingsBrands,
  useCreateBrand,
  useUpdateBrand,
  useDeleteBrand,
} from '../hooks/useSettings';
import type { Brand } from '../types';

export function BrandsManager() {
  const { data: brands = [], isLoading } = useSettingsBrands();
  const createMutation = useCreateBrand();
  const updateMutation = useUpdateBrand();
  const deleteMutation = useDeleteBrand();

  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      await createMutation.mutateAsync({ name });
      setNewName('');
      toast({ title: 'Brand created', variant: 'success' });
    } catch {
      toast({ title: 'Failed to create brand', variant: 'destructive' });
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    try {
      await updateMutation.mutateAsync({ id: editing.id, data: { name } });
      setEditing(null);
      toast({ title: 'Brand updated', variant: 'success' });
    } catch {
      toast({ title: 'Failed to update brand', variant: 'destructive' });
    }
  }

  async function handleDelete(brand: Brand) {
    if (!confirm(`Delete brand "${brand.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(brand.id);
      toast({ title: 'Brand deleted', variant: 'success' });
    } catch {
      toast({ title: 'Failed to delete brand', variant: 'destructive' });
    }
  }

  async function handleToggleActive(brand: Brand) {
    try {
      await updateMutation.mutateAsync({ id: brand.id, data: { isActive: !brand.isActive } });
    } catch {
      toast({ title: 'Failed to update brand', variant: 'destructive' });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="New brand name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="max-w-xs"
          aria-label="New brand name"
        />
        <Button onClick={handleCreate} disabled={!newName.trim()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Brand
        </Button>
      </div>

      {brands.length === 0 ? (
        <p className="text-sm text-muted-foreground">No brands yet.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.map((brand) => (
                <TableRow key={brand.id}>
                  <TableCell>
                    {editing?.id === brand.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editing.name}
                          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                          className="h-7 w-40"
                          aria-label="Edit brand name"
                        />
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="text-green-600 hover:text-green-800"
                          aria-label="Confirm edit"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Cancel edit"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className={brand.isActive ? '' : 'text-muted-foreground line-through'}>
                        {brand.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(brand)}
                      aria-label={`Toggle ${brand.name} active`}
                    >
                      <Badge variant={brand.isActive ? 'default' : 'secondary'}>
                        {brand.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing({ id: brand.id, name: brand.name })}
                        aria-label={`Edit ${brand.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(brand)}
                        aria-label={`Delete ${brand.name}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
