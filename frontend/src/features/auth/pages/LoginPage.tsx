import { Navigate } from 'react-router';
import { useAuth } from '@/app/providers';
import { LoginForm } from '@/features/auth/components/LoginForm';

export function LoginPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — hidden on mobile */}
      <div className="relative hidden lg:flex flex-col justify-between bg-foreground px-12 py-10 overflow-hidden">
        {/* Dot-grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, oklch(1 0 0 / 0.055) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Logomark */}
        <div className="relative z-10 flex items-center gap-2.5">
          <span className="inline-block h-px w-7 bg-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            TyreStock
          </span>
        </div>

        {/* Brand copy */}
        <div className="relative z-10">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
            Workshop management
          </p>
          <h1 className="text-[3rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">
            Stock levels.
            <br />
            Sales history.
            <br />
            Low-stock alerts.
          </h1>
        </div>

        {/* Version */}
        <div className="relative z-10 font-mono text-[11px] text-white/20">v0.1.0</div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-6 py-12 lg:px-14">
        {/* Mobile logomark */}
        <div className="absolute left-6 top-6 flex items-center gap-2 lg:hidden">
          <span className="inline-block h-px w-6 bg-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            TyreStock
          </span>
        </div>

        <div className="w-full max-w-sm">
          <h2 className="mb-7 text-2xl font-bold tracking-tight">Sign in</h2>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
