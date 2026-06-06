import { useNavigate } from 'react-router';
import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { useAuth } from '@/app/providers';

interface TopbarProps {
  onMenuClick?: () => void;
  /** Show the hamburger that opens the drawer (tablet layout only). */
  showMenuButton?: boolean;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function Topbar({ onMenuClick, showMenuButton = false }: TopbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = (): void => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
      {showMenuButton && (
        <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
      )}

      <div className="ml-auto flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-sm border border-border bg-surface-2 font-mono text-xs font-bold text-foreground"
            >
              {initials(user.fullName)}
            </span>
            <span className="hidden flex-col leading-none sm:flex">
              <span className="text-sm font-semibold tracking-tight">{user.fullName}</span>
              <span className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
                {user.role}
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
  );
}
