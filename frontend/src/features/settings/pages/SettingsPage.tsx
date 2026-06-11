import { useState } from 'react';
import { Skeleton } from '@/shared/ui/skeleton';
import { Toaster } from '@/shared/ui/toaster';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { useAuth } from '@/app/providers';
import { useSettings } from '../hooks/useSettings';
import { CompanyForm } from '../components/CompanyForm';
import { TaxSettings } from '../components/TaxSettings';
import { ReorderSettings } from '../components/ReorderSettings';
import { BrandsManager } from '../components/BrandsManager';
import { CategoriesManager } from '../components/CategoriesManager';
import { DemoDataCard } from '../components/DemoDataCard';
import { ExportDataCard } from '../components/ExportDataCard';
import { TeamManager } from '../components/TeamManager';

type Tab = 'company' | 'tax' | 'brands' | 'categories' | 'team' | 'data';

const TABS: { label: string; value: Tab; permission?: string }[] = [
  { label: 'Company', value: 'company' },
  { label: 'Tax & Inventory', value: 'tax' },
  { label: 'Brands', value: 'brands' },
  { label: 'Categories', value: 'categories' },
  { label: 'Team', value: 'team', permission: 'team:manage' },
  { label: 'Sample data', value: 'data' },
];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('company');
  const { user } = useAuth();
  const { data: settings, isLoading, isError } = useSettings();
  const visibleTabs = TABS.filter(
    (t) => !t.permission || user?.permissions.includes(t.permission),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Shop configuration
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Settings sections">
        {visibleTabs.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={
              tab === t.value
                ? 'rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
                : 'rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load settings. Please refresh.
        </div>
      )}

      {tab === 'company' && (
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : settings ? (
              <CompanyForm settings={settings} />
            ) : null}
          </CardContent>
        </Card>
      )}

      {tab === 'tax' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tax Settings</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-32" />
              ) : settings ? (
                <TaxSettings settings={settings} />
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Inventory Settings</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-32" />
              ) : settings ? (
                <ReorderSettings settings={settings} />
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'brands' && (
        <Card>
          <CardHeader>
            <CardTitle>Brands</CardTitle>
          </CardHeader>
          <CardContent>
            <BrandsManager />
          </CardContent>
        </Card>
      )}

      {tab === 'categories' && (
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoriesManager />
          </CardContent>
        </Card>
      )}

      {tab === 'team' && (
        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
          </CardHeader>
          <CardContent>
            <TeamManager />
          </CardContent>
        </Card>
      )}

      {tab === 'data' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export your data</CardTitle>
            </CardHeader>
            <CardContent>
              <ExportDataCard />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sample data</CardTitle>
            </CardHeader>
            <CardContent>
              <DemoDataCard />
            </CardContent>
          </Card>
        </div>
      )}

      <Toaster />
    </div>
  );
}
