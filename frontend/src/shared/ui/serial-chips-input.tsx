import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface SerialChipsInputProps {
  /** Comma-separated serials — the parent keeps this exact shape in its state. */
  value: string;
  onChange: (text: string) => void;
  /** Expected unit count; the counter turns red when serials exceed it. */
  quantity?: number;
  label: string;
  placeholder?: string;
  className?: string;
}

const parse = (text: string): string[] =>
  text.split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Chip-style entry for per-unit serial numbers. Typing a comma/Enter commits a
 * chip, so typos and duplicates are visible immediately instead of surfacing as
 * a 409 at submit time. State stays comma-separated text for the parent.
 */
export function SerialChipsInput({
  value,
  onChange,
  quantity,
  label,
  placeholder = 'Type a serial, press Enter',
  className,
}: SerialChipsInputProps) {
  const [draft, setDraft] = useState('');
  const chips = parse(value);
  const duplicates = new Set(chips.filter((c, i) => chips.indexOf(c) !== i));
  const tooMany = quantity !== undefined && chips.length > quantity;

  function commit(): void {
    const next = draft.trim().replace(/,+$/, '');
    if (!next) return;
    onChange([...chips, next].join(','));
    setDraft('');
  }

  function removeAt(index: number): void {
    onChange(chips.filter((_, i) => i !== index).join(','));
  }

  return (
    <div className={className}>
      <div
        className={cn(
          'flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5',
          (tooMany || duplicates.size > 0) && 'border-destructive/60',
        )}
      >
        {chips.map((chip, i) => (
          <span
            key={`${chip}-${i}`}
            className={cn(
              'inline-flex items-center gap-1 rounded-sm border bg-surface-2 px-1.5 py-0.5 font-mono text-[0.7rem]',
              duplicates.has(chip)
                ? 'border-destructive/60 text-destructive'
                : 'border-border text-foreground',
            )}
          >
            {chip}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove serial ${chip}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => {
            // A pasted/typed comma commits everything before it.
            if (e.target.value.includes(',')) {
              const parts = e.target.value.split(',');
              const last = parts.pop() ?? '';
              const committed = parts.map((s) => s.trim()).filter(Boolean);
              if (committed.length > 0) onChange([...chips, ...committed].join(','));
              setDraft(last);
              return;
            }
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Backspace' && draft === '' && chips.length > 0) {
              removeAt(chips.length - 1);
            }
          }}
          onBlur={commit}
          placeholder={chips.length === 0 ? placeholder : ''}
          aria-label={label}
          className="min-w-[8rem] flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>
      {(quantity !== undefined || duplicates.size > 0) && (
        <p
          className={cn(
            'mt-1 text-[0.68rem]',
            tooMany || duplicates.size > 0 ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {duplicates.size > 0
            ? 'Duplicate serials highlighted'
            : quantity !== undefined
              ? `${chips.length}/${quantity} serial${quantity !== 1 ? 's' : ''}`
              : null}
        </p>
      )}
    </div>
  );
}
