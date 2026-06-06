import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { useAuth } from '@/app/providers';
import { AppShell } from '@/app/layout/AppShell';
import { LoginPage } from '@/features/auth/pages/LoginPage';
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
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppShell />;
}

function PublicRoot() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

// ─── Route table ──────────────────────────────────────────────────────────────

export const routes: RouteObject[] = [
  { path: '/', element: <PublicRoot /> },
  { path: '/login', element: <LoginPage /> },
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
  { path: '*', element: <Navigate to="/" replace /> },
];

export const appRouter = createBrowserRouter(routes);
