import * as React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Calendar } from '@/shared/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

interface DatePickerProps {
  /** ISO date string (yyyy-MM-dd) or ''. */
  value: string;
  onChange: (val: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Lower/upper year bounds — limit navigation without changing the caption. */
  fromYear?: number;
  toYear?: number;
}

function parseDate(str: string): Date | undefined {
  if (!str) return undefined;
  const d = parseISO(str);
  return isValid(d) ? d : undefined;
}

/**
 * Single-date picker on the shared Calendar + Popover. Uses the same clean,
 * arrow-navigated calendar as DateRangePicker so every date control in the app
 * looks identical — year bounds limit navigation rather than swapping in
 * dropdown chrome.
 */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder = 'Pick a date',
  className,
  disabled,
  fromYear,
  toYear,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseDate(value);

  const fromDate = fromYear !== undefined ? new Date(fromYear, 0, 1) : undefined;
  const toDate = toYear !== undefined ? new Date(toYear, 11, 31) : undefined;

  function handleSelect(date: Date | undefined) {
    onChange(date ? format(date, 'yyyy-MM-dd') : '');
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {selected ? format(selected, 'dd MMM yyyy') : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="single"
          defaultMonth={selected}
          selected={selected}
          onSelect={handleSelect}
          fromDate={fromDate}
          toDate={toDate}
        />
      </PopoverContent>
    </Popover>
  );
}
