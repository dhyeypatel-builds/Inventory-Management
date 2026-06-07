import { Eye, X } from 'lucide-react';
import { readImpersonation, exitImpersonation } from '../lib/impersonation';

/**
 * Persistent banner shown across the tenant app while a platform admin is
 * impersonating a shop. Rendered from the tenant AppShell; renders nothing for
 * ordinary tenant sessions.
 */
export function ImpersonationBanner() {
  const state = readImpersonation();
  if (!state) return null;

  return (
    <div className="flex items-center gap-3 bg-foreground px-4 py-2 text-background">
      <Eye className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-sm">
        Viewing <strong className="font-semibold">{state.tenantName}</strong> as platform admin.
      </p>
      <button
        type="button"
        onClick={exitImpersonation}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-background/25 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-background/10"
      >
        <X className="h-3.5 w-3.5" />
        Exit
      </button>
    </div>
  );
}
