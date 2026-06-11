import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/app/providers';
import { AppShell } from '@/app/layout/AppShell';
import { usePlatformAuth } from '@/features/platform/context/PlatformAuthProvider';
import { PlatformShell } from '@/features/platform/layout/PlatformShell';
import { PlatformLoginPage } from '@/features/platform/pages/PlatformLoginPage';
import { TenantListPage } from '@/features/platform/pages/TenantListPage';
import { TenantDetailPage } from '@/features/platform/pages/TenantDetailPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { AccountPage } from '@/features/auth/pages/AccountPage';
import { InviteAcceptPage } from '@/features/auth/pages/InviteAcceptPage';
import { OnboardingPage } from '@/features/onboarding/pages/OnboardingPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { ProductListPage } from '@/features/products/pages/ProductListPage';
import { ProductFormPage } from '@/features/products/pages/ProductFormPage';
import { InventoryListPage } from '@/features/inventory/pages/InventoryListPage';
import { PosPage } from '@/features/sales/pages/PosPage';
import { SalesHistoryPage } from '@/features/sales/pages/SalesHistoryPage';
import { PurchaseHistoryPage } from '@/features/purchases/pages/PurchaseHistoryPage';
import { PurchaseEntryPage } from '@/features/purchases/pages/PurchaseEntryPage';
import { CustomerListPage } from '@/features/customers/pages/CustomerListPage';
import { CustomerDetailPage } from '@/features/customers/pages/CustomerDetailPage';
import { ReportsPage } from '@/features/reports/pages/ReportsPage';
import { AlertsPage } from '@/features/alerts/pages/AlertsPage';
import { SettingsPage } from '@/features/settings/pages/SettingsPage';
import { LandingPage } from '@/features/landing/LandingPage';

// ─── Route guards ───────────────────────────────────────────────────────────────

function RequireAuth() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Gate the app behind onboarding (ON-01): unfinished shops go to the wizard.
  if (user && !user.onboardingCompletedAt) return <Navigate to="/welcome" replace />;
  return <AppShell />;
}

function RequireOnboarding() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <OnboardingPage />; // redirects to /dashboard itself once complete
}

/** Friendly in-shell screen for pages the user's role can't open. */
function AccessDenied() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-md border border-dashed p-8 text-center">
      <ShieldAlert className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-lg font-semibold">You don't have access to this page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Your role doesn't include this area. Ask the shop owner to adjust your
        role if you need it.
      </p>
    </div>
  );
}

/**
 * Per-route permission gate. The API enforces this too — the guard just turns a
 * raw 403 into a clear explanation for direct URL visits.
 */
function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (user && !user.permissions.includes(permission)) return <AccessDenied />;
  return <>{children}</>;
}

function PublicRoot() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function RequirePlatform() {
  const { isAuthenticated } = usePlatformAuth();
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  return <PlatformShell />;
}

// ─── Route table ──────────────────────────────────────────────────────────────

export const routes: RouteObject[] = [
  { path: '/', element: <PublicRoot /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/invite/:token', element: <InviteAcceptPage /> },
  { path: '/welcome', element: <RequireOnboarding /> },
  {
    element: <RequireAuth />,
    children: [
      { path: 'dashboard', element: <RequirePermission permission="dashboard:read"><DashboardPage /></RequirePermission> },
      { path: 'products', element: <RequirePermission permission="product:read"><ProductListPage /></RequirePermission> },
      { path: 'products/new', element: <RequirePermission permission="product:write"><ProductFormPage /></RequirePermission> },
      { path: 'products/:id/edit', element: <RequirePermission permission="product:write"><ProductFormPage /></RequirePermission> },
      { path: 'inventory', element: <RequirePermission permission="inventory:read"><InventoryListPage /></RequirePermission> },
      { path: 'sales', element: <RequirePermission permission="sale:read"><SalesHistoryPage /></RequirePermission> },
      { path: 'sales/pos', element: <RequirePermission permission="sale:create"><PosPage /></RequirePermission> },
      { path: 'purchases', element: <RequirePermission permission="purchase:read"><PurchaseHistoryPage /></RequirePermission> },
      { path: 'purchases/new', element: <RequirePermission permission="purchase:create"><PurchaseEntryPage /></RequirePermission> },
      { path: 'customers', element: <RequirePermission permission="customer:read"><CustomerListPage /></RequirePermission> },
      { path: 'customers/:id', element: <RequirePermission permission="customer:read"><CustomerDetailPage /></RequirePermission> },
      { path: 'reports', element: <RequirePermission permission="report:read"><ReportsPage /></RequirePermission> },
      { path: 'alerts', element: <RequirePermission permission="alert:read"><AlertsPage /></RequirePermission> },
      { path: 'settings', element: <RequirePermission permission="settings:read"><SettingsPage /></RequirePermission> },
      // Every signed-in user can manage their own sign-in (no permission gate).
      { path: 'account', element: <AccountPage /> },
    ],
  },

  // ─── Master-admin console (separate trust domain) ──────────────────────────
  { path: '/admin/login', element: <PlatformLoginPage /> },
  {
    path: '/admin',
    element: <RequirePlatform />,
    children: [
      { index: true, element: <Navigate to="/admin/tenants" replace /> },
      { path: 'tenants', element: <TenantListPage /> },
      { path: 'tenants/:id', element: <TenantDetailPage /> },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
];

export const appRouter = createBrowserRouter(routes);
