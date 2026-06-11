import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { useVisibleNavItems } from './Sidebar';

/** How many destinations fit comfortably as bottom-bar tabs on a phone. */
const MAX_BAR_ITEMS = 4;

/**
 * Mobile bottom navigation bar. Shown below the `md` breakpoint in place of the
 * sidebar/drawer. The first few (permission-visible) destinations get tabs with
 * comfortable touch targets; the rest live behind a "More" sheet so nine icons
 * never squeeze into a phone-width bar.
 */
export function BottomNav() {
  const items = useVisibleNavItems();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  const needsMore = items.length > MAX_BAR_ITEMS + 1;
  const barItems = needsMore ? items.slice(0, MAX_BAR_ITEMS) : items;
  const moreItems = needsMore ? items.slice(MAX_BAR_ITEMS) : [];
  const moreActive = moreItems.some((item) => location.pathname.startsWith(item.to));

  return (
    <nav
      aria-label="Main navigation"
      className="flex shrink-0 items-stretch border-t bg-surface-2"
    >
      {barItems.map(({ to, label, icon: Icon, end }) => (
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

      {moreItems.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-[10px] font-medium transition-colors',
              moreActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>

          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetContent side="bottom" className="pb-6">
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
              </SheetHeader>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {moreItems.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex flex-col items-center justify-center gap-1.5 rounded-md border px-2 py-3 text-xs font-medium transition-colors',
                        isActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )
                    }
                  >
                    <Icon className="h-5 w-5" />
                    <span className="whitespace-nowrap">{label}</span>
                  </NavLink>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </nav>
  );
}
