import { REPORT_NAMES, REPORT_LABELS, type ReportName } from '../types';

interface ReportSelectorProps {
  value: ReportName | null;
  onChange: (name: ReportName) => void;
}

export function ReportSelector({ value, onChange }: ReportSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Select report type">
      {REPORT_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          aria-pressed={value === name}
          className={
            value === name
              ? 'rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
              : 'rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }
        >
          {REPORT_LABELS[name]}
        </button>
      ))}
    </div>
  );
}
