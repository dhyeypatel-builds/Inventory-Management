import { useState, useRef, useEffect } from 'react';
import { User, UserPlus, X } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { toast } from '@/shared/ui/use-toast';
import { useCustomerSearch } from '../hooks/useSales';
import { createCustomer } from '../api/sales.api';
import type { Customer } from '../types';

interface CustomerPickerProps {
  selected: Customer | null;
  onSelect: (customer: Customer | null) => void;
}

export function CustomerPicker({ selected, onSelect }: CustomerPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useCustomerSearch(query, query.length >= 2);
  const results = data?.customers ?? [];

  const trimmed = query.trim();
  const exactMatch = results.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());

  async function handleCreate() {
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const customer = await createCustomer({ name: trimmed });
      toast({ title: `Customer "${customer.name}" added`, variant: 'success' });
      onSelect(customer);
      setQuery('');
      setOpen(false);
    } catch {
      toast({ title: 'Could not add customer', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{selected.name}</div>
            {selected.phone && (
              <div className="text-xs text-muted-foreground">{selected.phone}</div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelect(null)}
          aria-label="Remove customer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customer (optional)…"
          className="pl-8"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(e.target.value.length >= 2);
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          aria-label="Search customer"
        />
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Customer results"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md"
        >
          {results.map((c) => (
            <button
              key={c.id}
              role="option"
              aria-selected={false}
              className="flex w-full flex-col px-4 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onSelect(c);
                setQuery('');
                setOpen(false);
              }}
            >
              <span className="font-medium">{c.name}</span>
              {c.phone && (
                <span className="text-xs text-muted-foreground">{c.phone}</span>
              )}
            </button>
          ))}

          {/* Walk-in customers get created on the spot — never lose the name off an invoice */}
          {!exactMatch && trimmed.length >= 2 && (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent"
              onClick={handleCreate}
              disabled={creating}
            >
              <UserPlus className="h-4 w-4 shrink-0" />
              {creating ? 'Adding…' : `Add "${trimmed}" as new customer`}
            </button>
          )}

          {results.length === 0 && trimmed.length < 2 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">No customers found.</div>
          )}
        </div>
      )}
    </div>
  );
}
