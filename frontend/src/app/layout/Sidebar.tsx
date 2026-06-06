import { NavLink, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Users,
  FileBarChart,
  BellRing,
  Settings,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Exact match for the index route so it isn't always active. */
  end?: boolean;
}

// All MVP screens.
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/sales', label: 'Sales History', icon: ShoppingCart },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/alerts', label: 'Stock Alerts', icon: BellRing },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/** Amber tile + wordmark. The brand mark for the app. */
export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 place-items-center rounded-sm bg-primary font-mono text-base font-bold text-primary-foreground shadow-panel"
      >
        T
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[0.95rem] font-bold tracking-tight">TyreStock</span>
        <span className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
          Inventory · POS
        </span>
      </span>
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full flex-col bg-surface-2"
    >
      <div className="px-5 pb-4 pt-5">
        <Wordmark />
      </div>

      <div className="px-3 pb-2">
        <Button
          className="w-full justify-start gap-2"
          onClick={() => {
            onNavigate?.();
            navigate('/sales/pos');
          }}
        >
          <Plus className="h-4 w-4" />
          New Sale
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/12 font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'h-[1.05rem] w-[1.05rem] shrink-0 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                  )}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
