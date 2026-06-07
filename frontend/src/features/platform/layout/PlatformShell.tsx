import { Outlet, useNavigate } from 'react-router';
import { LogOut, Building2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Toaster } from '@/shared/ui/toaster';
import { usePlatformAuth } from '../context/PlatformAuthProvider';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function PlatformShell() {
  const { admin, logout } = usePlatformAuth();
  const navigate = useNavigate();

  const handleLogout = (): void => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Brand stripe — the platform signature */}
      <div className="h-[3px] w-full bg-primary" aria-hidden="true" />

      <header className="flex h-14 items-center gap-3 border-b bg-background px-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-sm bg-foreground text-background">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight">TyreStock</span>
            <span className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
              Platform console
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {admin && (
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid h-8 w-8 place-items-center rounded-sm border border-border bg-surface-2 font-mono text-xs font-bold text-foreground"
              >
                {initials(admin.fullName)}
              </span>
              <span className="hidden flex-col leading-none sm:flex">
                <span className="text-sm font-semibold tracking-tight">{admin.fullName}</span>
                <span className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Master admin
                </span>
              </span>
            </div>
          )}
          <div className="h-6 w-px bg-border" aria-hidden="true" />
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
