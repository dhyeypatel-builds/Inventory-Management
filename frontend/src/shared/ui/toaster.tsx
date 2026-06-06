import { useEffect } from 'react';
import { cn } from '@/shared/lib/cn';
import { X } from 'lucide-react';
import { useToastStore, dismiss } from './use-toast';

export function Toaster() {
  const { toasts, subscribe } = useToastStore();

  useEffect(() => {
    return subscribe();
  }, [subscribe]);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          className={cn(
            'flex w-80 items-start gap-3 rounded-md border px-4 py-3 shadow-md',
            t.variant === 'destructive'
              ? 'border-destructive bg-destructive text-destructive-foreground'
              : t.variant === 'success'
                ? 'border-green-200 bg-green-50 text-green-900'
                : 'border bg-background text-foreground',
          )}
        >
          <div className="flex-1">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description && <p className="mt-0.5 text-sm opacity-90">{t.description}</p>}
          </div>
          <button
            aria-label="Dismiss notification"
            onClick={() => dismiss(t.id)}
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
