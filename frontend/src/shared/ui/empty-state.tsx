import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';

interface EmptyStateProps {
  icon: ComponentType<LucideProps>;
  title: string;
  description: string;
  /** Optional primary action (e.g. a button or link). */
  action?: ReactNode;
}

/** First-class empty state for lists/screens with no data yet. */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-2/40 px-6 py-14 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-md border border-border bg-card text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-base font-semibold tracking-tight">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
