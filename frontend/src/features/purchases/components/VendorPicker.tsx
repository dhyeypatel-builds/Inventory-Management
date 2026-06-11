import { useState, useRef, useEffect } from 'react';
import { Building2, X } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { useVendorSearch } from '../hooks/usePurchases';
import type { Vendor } from '../types';

export interface VendorSelection {
  /** Set when an existing vendor was picked. */
  vendorId?: string;
  /** The display / free-typed name. New names create the vendor on submit. */
  name: string;
}

interface VendorPickerProps {
  selected: VendorSelection | null;
  onSelect: (selection: VendorSelection | null) => void;
}

/**
 * Search-or-type vendor picker. Picking a result links the existing vendor;
 * a free-typed name is created server-side when the purchase is saved.
 */
export function VendorPicker({ selected, onSelect }: VendorPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: results = [] } = useVendorSearch(query, query.length >= 2);

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
      <div className="flex items-center justify-between rounded-sm border border-border bg-card px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{selected.name}</div>
            {!selected.vendorId && (
              <div className="text-xs text-muted-foreground">New vendor — created on save</div>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelect(null)} aria-label="Remove vendor">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const trimmed = query.trim();
  const exactMatch = results.some((v) => v.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search or type vendor name…"
          className="pl-8"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(e.target.value.trim().length >= 2);
          }}
          onFocus={() => trimmed.length >= 2 && setOpen(true)}
          aria-label="Vendor"
        />
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Vendor results"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-sm border border-border bg-popover shadow-overlay"
        >
          {results.map((v: Vendor) => (
            <button
              key={v.id}
              role="option"
              aria-selected={false}
              className="flex w-full flex-col px-4 py-2.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                onSelect({ vendorId: v.id, name: v.name });
                setQuery('');
                setOpen(false);
              }}
            >
              <span className="font-medium">{v.name}</span>
              {v.phone && <span className="font-mono text-xs text-muted-foreground">{v.phone}</span>}
            </button>
          ))}

          {!exactMatch && trimmed.length >= 2 && (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-sm font-medium text-success hover:bg-accent"
              onClick={() => {
                onSelect({ name: trimmed });
                setQuery('');
                setOpen(false);
              }}
            >
              Use &ldquo;{trimmed}&rdquo; as new vendor
            </button>
          )}
        </div>
      )}
    </div>
  );
}
