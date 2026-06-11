import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from './pages/DashboardPage';
import * as dashboardApi from './api/dashboard.api';
import * as inventoryApi from './api/inventory.api';

jest.mock('./api/dashboard.api');
jest.mock('./api/inventory.api');

const mockSummary = jest.mocked(dashboardApi.getSummary);
const mockTrend = jest.mocked(dashboardApi.getSalesTrend);
const mockRevenueSeries = jest.mocked(dashboardApi.getRevenueSeries);
const mockBrands = jest.mocked(dashboardApi.getTopBrands);
const mockFastMoving = jest.mocked(dashboardApi.getFastMoving);
const mockLowStock = jest.mocked(inventoryApi.getLowStockItems);

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DashboardPage />
    </QueryClientProvider>,
  );
  return qc;
}

const summaryData = {
  today: { salesCount: 3, revenue: 5000 },
  mtd: { salesCount: 42, revenue: 95000 },
  totalSkus: 120,
  stockValue: 350000,
  openAlerts: 0,
};

beforeEach(() => {
  mockSummary.mockResolvedValue(summaryData);
  mockTrend.mockResolvedValue([{ date: '2026-06-01', salesCount: 3, revenue: 5000 }]);
  mockRevenueSeries.mockResolvedValue([{ period: '2026-06-01', salesCount: 3, revenue: 5000 }]);
  mockBrands.mockResolvedValue([{ brandId: 1, brandName: 'MRF', units: 20, revenue: 40000 }]);
  mockFastMoving.mockResolvedValue([]);
  mockLowStock.mockResolvedValue([]);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('DashboardPage', () => {
  it('renders the Dashboard heading', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('shows loading skeletons initially', () => {
    // Make the query hang so we can observe loading state
    mockSummary.mockReturnValue(new Promise(() => {}));
    renderDashboard();
    // KpiCards render their Skeleton children
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders KPI values after data loads', async () => {
    renderDashboard();
    // Today revenue: exact value £5,000.00 (not ₹95,000)
    expect(await screen.findByText('£5,000.00')).toBeInTheDocument();
    // MTD revenue ₹95,000
    expect(await screen.findByText('£95,000.00')).toBeInTheDocument();
    // Total SKUs
    expect(await screen.findByText('120')).toBeInTheDocument();
  });

  it('shows an error message and retry button when the summary fails', async () => {
    mockSummary.mockRejectedValue(new Error('Network error'));
    renderDashboard();

    expect(await screen.findByText(/could not load dashboard/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    // Clicking retry re-fetches
    mockSummary.mockResolvedValue(summaryData);
    await userEvent.click(retryBtn);
    expect(await screen.findByText('£5,000.00')).toBeInTheDocument();
  });

  it('renders Top Brands section', async () => {
    renderDashboard();
    expect(await screen.findByText('Top Brands')).toBeInTheDocument();
    expect(await screen.findByText('MRF')).toBeInTheDocument();
  });

  it('shows "All stock levels healthy" when no low-stock items', async () => {
    renderDashboard();
    expect(await screen.findByText(/all stock levels are healthy/i)).toBeInTheDocument();
  });

  it('renders low stock items with their on-hand badge', async () => {
    mockLowStock.mockResolvedValue([
      {
        variantId: 'v1',
        sku: 'TYR-001',
        productName: 'MRF 195/65R15',
        brandName: 'MRF',
        onHand: 2,
        reorderLevel: 5,
      },
    ]);
    renderDashboard();
    expect(await screen.findByText('MRF 195/65R15')).toBeInTheDocument();
    expect(await screen.findByText('2 left')).toBeInTheDocument();
  });
});
