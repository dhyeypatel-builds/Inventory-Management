import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { formatCurrency } from '@/shared/lib/currency';
import { useVariantSearch } from '../hooks/useSales';
import type { VariantSearchResult } from '../types';
import { cn } from '@/shared/lib/cn';

interface ItemSearchProps {
  onAdd: (variant: VariantSearchResult) => void;
}

export function ItemSearch({ onAdd }: ItemSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useVariantSearch({ q: query }, query.length >= 2);
  const results = data?.variants ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleSelect(v: VariantSearchResult) {
    onAdd(v);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search product or SKU…"
          className="pl-8"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(e.target.value.length >= 2);
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          aria-label="Search products"
          aria-autocomplete="list"
          aria-expanded={open}
        />
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-sm border border-border bg-popover shadow-overlay"
        >
          {isLoading && (
            <div className="px-4 py-3 text-sm text-muted-foreground">Searching…</div>
          )}
          {!isLoading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">No results.</div>
          )}
          {results.map((v) => (
            <button
              key={v.id}
              role="option"
              aria-selected={false}
              className={cn(
                'flex w-full items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-accent',
                v.onHand === 0 && 'opacity-55',
              )}
              onClick={() => handleSelect(v)}
              disabled={v.onHand === 0}
            >
              <div className="min-w-0">
                <div className="truncate font-semibold">{v.productName}</div>
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {v.sku}
                  {v.brandName ? ` · ${v.brandName}` : ''}
                  <span className={cn('ml-1', v.onHand === 0 ? 'text-[oklch(0.48_0.2_27)]' : 'text-[oklch(0.45_0.13_150)]')}>
                    · {v.onHand === 0 ? 'Out of stock' : `${v.onHand} in stock`}
                  </span>
                </div>
              </div>
              <span className="ml-4 shrink-0 font-mono tabular font-bold">{formatCurrency(v.sellingPrice)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
