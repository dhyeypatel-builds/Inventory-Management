import * as React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Calendar } from '@/shared/ui/calendar';
import { Label } from '@/shared/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (val: string) => void;
  onToChange: (val: string) => void;
}

function parseDate(str: string): Date | undefined {
  if (!str) return undefined;
  const d = parseISO(str);
  return isValid(d) ? d : undefined;
}

export function DateRangePicker({ from, to, onFromChange, onToChange }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected: DateRange = {
    from: parseDate(from),
    to: parseDate(to),
  };

  function handleSelect(range: DateRange | undefined) {
    onFromChange(range?.from ? format(range.from, 'yyyy-MM-dd') : '');
    onToChange(range?.to ? format(range.to, 'yyyy-MM-dd') : '');
    if (range?.from && range?.to) setOpen(false);
  }

  const label = selected.from
    ? selected.to
      ? `${format(selected.from, 'dd MMM yyyy')} – ${format(selected.to, 'dd MMM yyyy')}`
      : format(selected.from, 'dd MMM yyyy')
    : 'Pick a date range';

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">Date Range</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('w-60 justify-start text-left font-normal', !selected.from && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={selected.from}
            selected={selected}
            onSelect={handleSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
