import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { toast } from '@/shared/ui/use-toast';

interface QuickAddDialogProps {
  /** What is being created — used for labels, e.g. "brand" or "category". */
  entity: string;
  /** Creates the record and resolves with its new id. */
  onCreate: (name: string) => Promise<{ id: number }>;
  /** Called with the new id so the parent form can select it. */
  onCreated: (id: number) => void;
}

/**
 * A small "+" button beside a select that lets the user create a missing
 * brand/category without leaving the product form.
 */
export function QuickAddDialog({ entity, onCreate, onCreated }: QuickAddDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const createdRecord = await onCreate(trimmed);
      toast({ title: `${capitalize(entity)} "${trimmed}" added`, variant: 'success' });
      onCreated(createdRecord.id);
      setName('');
      setOpen(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? `Failed to add ${entity}`;
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        aria-label={`Add new ${entity}`}
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New {entity}</DialogTitle>
            <DialogDescription>
              Add a {entity} without leaving this form.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor={`quick-add-${entity}`}>Name</Label>
            <Input
              id={`quick-add-${entity}`}
              value={name}
              autoFocus
              placeholder={`${capitalize(entity)} name`}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} disabled={saving || !name.trim()}>
              {saving ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
