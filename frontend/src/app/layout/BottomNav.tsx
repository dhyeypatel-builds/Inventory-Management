import { NavLink } from 'react-router';
import { cn } from '@/shared/lib/cn';
import { NAV_ITEMS } from './Sidebar';

/**
 * Mobile bottom navigation bar. Shown below the `md` breakpoint in place of the
 * sidebar/drawer. Touch-friendly targets (min 56px tall) and horizontally
 * scrollable so all MVP screens stay reachable on narrow phones.
 */
export function BottomNav() {
  return (
    <nav
      aria-label="Main navigation"
      className="flex shrink-0 items-stretch overflow-x-auto border-t bg-surface-2"
    >
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-[10px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          <Icon className="h-5 w-5" />
          <span className="whitespace-nowrap">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
