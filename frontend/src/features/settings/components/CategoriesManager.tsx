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
  useSettingsCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '../hooks/useSettings';
import type { Category } from '../types';

export function CategoriesManager() {
  const { data: categories = [], isLoading } = useSettingsCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      await createMutation.mutateAsync({ name });
      setNewName('');
      toast({ title: 'Category created', variant: 'success' });
    } catch {
      toast({ title: 'Failed to create category', variant: 'destructive' });
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    try {
      await updateMutation.mutateAsync({ id: editing.id, data: { name } });
      setEditing(null);
      toast({ title: 'Category updated', variant: 'success' });
    } catch {
      toast({ title: 'Failed to update category', variant: 'destructive' });
    }
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(cat.id);
      toast({ title: 'Category deleted', variant: 'success' });
    } catch {
      toast({ title: 'Failed to delete category', variant: 'destructive' });
    }
  }

  async function handleToggleActive(cat: Category) {
    try {
      await updateMutation.mutateAsync({ id: cat.id, data: { isActive: !cat.isActive } });
    } catch {
      toast({ title: 'Failed to update category', variant: 'destructive' });
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
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="max-w-xs"
          aria-label="New category name"
        />
        <Button onClick={handleCreate} disabled={!newName.trim()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell>
                    {editing?.id === cat.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editing.name}
                          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                          className="h-7 w-40"
                          aria-label="Edit category name"
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
                      <span className={cat.isActive ? '' : 'text-muted-foreground line-through'}>
                        {cat.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {cat.parent?.name ?? '—'}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(cat)}
                      aria-label={`Toggle ${cat.name} active`}
                    >
                      <Badge variant={cat.isActive ? 'default' : 'secondary'}>
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing({ id: cat.id, name: cat.name })}
                        aria-label={`Edit ${cat.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(cat)}
                        aria-label={`Delete ${cat.name}`}
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
