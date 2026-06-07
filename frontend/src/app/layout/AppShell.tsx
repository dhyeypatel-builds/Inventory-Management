import { useState } from 'react';
import { Outlet } from 'react-router';
import { cn } from '@/shared/lib/cn';
import { useLayout } from '@/shared/hooks/useMediaQuery';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';
import { Toaster } from '@/shared/ui/toaster';
import { ImpersonationBanner } from '@/features/platform/components/ImpersonationBanner';

/**
 * The authenticated app frame. Layout adapts across three breakpoints (I-01):
 *   - desktop (lg+): persistent sidebar
 *   - tablet (md):   sidebar collapses into a slide-over drawer (hamburger)
 *   - mobile (<md):  sidebar replaced by a bottom navigation bar
 */
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isMobile, isTablet, isDesktop } = useLayout();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <ImpersonationBanner />
      <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Desktop: persistent sidebar */}
      {isDesktop && (
        <aside className="w-64 shrink-0 border-r border-border">
          <Sidebar />
        </aside>
      )}

      {/* Tablet: slide-over drawer */}
      {isTablet && drawerOpen && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px]"
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r shadow-overlay">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar showMenuButton={isTablet} onMenuClick={() => setDrawerOpen(true)} />
        <main className={cn('flex-1 overflow-auto p-4 md:p-6', isMobile && 'pb-4')}>
          <Outlet />
        </main>
        {/* Mobile: bottom navigation */}
        {isMobile && <BottomNav />}
      </div>
      </div>
      <Toaster />
    </div>
  );
}
