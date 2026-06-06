import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportsPage } from './pages/ReportsPage';
import * as reportsApi from './api/reports.api';

jest.mock('./api/reports.api');

const mockGetReport = jest.mocked(reportsApi.getReport);
const mockExportReport = jest.mocked(reportsApi.exportReport);

const mockReport = {
  name: 'sales' as const,
  title: 'Sales Report',
  range: { from: null, to: null },
  generatedAt: new Date().toISOString(),
  columns: [
    { key: 'invoice_no', label: 'Invoice' },
    { key: 'grand_total', label: 'Total', numeric: true },
  ],
  rows: [
    { invoice_no: 'INV-2026-000001', grand_total: '3540.00' },
    { invoice_no: 'INV-2026-000002', grand_total: '2100.00' },
  ],
  summary: { total_revenue: 5640, total_invoices: 2 },
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ReportsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockGetReport.mockResolvedValue(mockReport);
  mockExportReport.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('ReportsPage', () => {
  it('renders the Reports heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /reports/i })).toBeInTheDocument();
  });

  it('shows prompt when no report type selected', () => {
    renderPage();
    expect(screen.getByText(/select a report type/i)).toBeInTheDocument();
  });

  it('fetches and renders report rows after selecting a type', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /sales report/i }));

    expect(await screen.findByText('INV-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-000002')).toBeInTheDocument();
  });

  it('shows summary values when present', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /sales report/i }));

    await screen.findByText('INV-2026-000001');
    expect(screen.getByText(/total revenue/i)).toBeInTheDocument();
  });

  it('calls exportReport when CSV export button is clicked', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /sales report/i }));
    await screen.findByText('INV-2026-000001');

    await user.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() => {
      expect(mockExportReport).toHaveBeenCalledWith('sales', 'csv', expect.any(Object));
    });
  });

  it('calls exportReport when PDF export button is clicked', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /sales report/i }));
    await screen.findByText('INV-2026-000001');

    await user.click(screen.getByRole('button', { name: /export pdf/i }));

    await waitFor(() => {
      expect(mockExportReport).toHaveBeenCalledWith('sales', 'pdf', expect.any(Object));
    });
  });
});
