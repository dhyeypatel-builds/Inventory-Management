import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** Two-panel auth layout: dark brand panel (desktop) + content panel. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — hidden on mobile */}
      <div className="relative hidden lg:flex flex-col justify-between bg-foreground px-12 py-10 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, oklch(1 0 0 / 0.055) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Wordmark */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="inline-block h-[2px] w-9 bg-primary" />
          <span className="font-mono text-[14px] font-semibold uppercase tracking-[0.22em] text-primary">
            TyreStock
          </span>
        </div>

        {/* Hero copy with staggered entrance */}
        <div className="relative z-10">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
            Workshop management
          </p>
          <h1 className="text-[3rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">
            <span
              className="block ts-line-anim"
              style={{ animation: 'lineReveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both' }}
            >
              Stock levels.
            </span>
            <span
              className="block ts-line-anim"
              style={{ animation: 'lineReveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.28s both' }}
            >
              Sales history.
            </span>
            <span
              className="block ts-line-anim"
              style={{ animation: 'lineReveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.46s both' }}
            >
              Low-stock alerts.
            </span>
          </h1>
        </div>

        <div className="relative z-10 font-mono text-[11px] text-white/20">v0.1.0</div>
      </div>

      {/* Content panel */}
      <div className="flex items-center justify-center bg-background px-6 py-12 lg:px-14">
        <div className="absolute left-6 top-6 flex items-center gap-2 lg:hidden">
          <span className="inline-block h-px w-6 bg-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">TyreStock</span>
        </div>
        <div className="w-full max-w-sm">
          <h2 className="mb-7 text-2xl font-bold tracking-tight">{title}</h2>
          {children}
        </div>
        <Link
          to="/admin/login"
          className="absolute bottom-5 right-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          Platform admin
        </Link>
      </div>
    </div>
  );
}
