import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { useAuth } from '@/app/providers';
import { AppShell } from '@/app/layout/AppShell';
import { usePlatformAuth } from '@/features/platform/context/PlatformAuthProvider';
import { PlatformShell } from '@/features/platform/layout/PlatformShell';
import { PlatformLoginPage } from '@/features/platform/pages/PlatformLoginPage';
import { TenantListPage } from '@/features/platform/pages/TenantListPage';
import { TenantDetailPage } from '@/features/platform/pages/TenantDetailPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { InviteAcceptPage } from '@/features/auth/pages/InviteAcceptPage';
import { OnboardingPage } from '@/features/onboarding/pages/OnboardingPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { ProductListPage } from '@/features/products/pages/ProductListPage';
import { ProductFormPage } from '@/features/products/pages/ProductFormPage';
import { InventoryListPage } from '@/features/inventory/pages/InventoryListPage';
import { PosPage } from '@/features/sales/pages/PosPage';
import { SalesHistoryPage } from '@/features/sales/pages/SalesHistoryPage';
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
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'products', element: <ProductListPage /> },
      { path: 'products/new', element: <ProductFormPage /> },
      { path: 'products/:id/edit', element: <ProductFormPage /> },
      { path: 'inventory', element: <InventoryListPage /> },
      { path: 'sales', element: <SalesHistoryPage /> },
      { path: 'sales/pos', element: <PosPage /> },
      { path: 'customers', element: <CustomerListPage /> },
      { path: 'customers/:id', element: <CustomerDetailPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'alerts', element: <AlertsPage /> },
      { path: 'settings', element: <SettingsPage /> },
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
