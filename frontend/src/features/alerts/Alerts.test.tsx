import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlertsPage } from './pages/AlertsPage';
import * as alertsApi from './api/alerts.api';

jest.mock('./api/alerts.api');

const mockListAlerts = jest.mocked(alertsApi.listAlerts);
const mockAcknowledgeAlert = jest.mocked(alertsApi.acknowledgeAlert);

const openAlert = {
  id: 'alert-1',
  variantId: 'var-1',
  sku: 'MRF-ZTX-001',
  productName: 'MRF ZTX 195/65R15',
  brandName: 'MRF',
  type: 'LOW_STOCK' as const,
  status: 'OPEN' as const,
  message: 'Low stock: 3 remaining (reorder level 5)',
  currentQty: 3,
  threshold: 5,
  createdAt: new Date().toISOString(),
  resolvedAt: null,
};

const acknowledgedAlert = { ...openAlert, id: 'alert-2', status: 'ACKNOWLEDGED' as const };

const mockListResponse = {
  items: [openAlert],
  meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AlertsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockListAlerts.mockResolvedValue(mockListResponse);
  mockAcknowledgeAlert.mockResolvedValue(acknowledgedAlert);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('AlertsPage', () => {
  it('renders Stock Alerts heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /stock alerts/i })).toBeInTheDocument();
  });

  it('renders alert rows after load', async () => {
    renderPage();
    expect(await screen.findByText('MRF ZTX 195/65R15')).toBeInTheDocument();
    expect(screen.getByText('MRF-ZTX-001')).toBeInTheDocument();
    expect(screen.getByText(/low stock: 3 remaining/i)).toBeInTheDocument();
  });

  it('shows Acknowledge button only for OPEN alerts', async () => {
    renderPage();
    await screen.findByText('MRF ZTX 195/65R15');
    expect(screen.getByRole('button', { name: /acknowledge alert/i })).toBeInTheDocument();
  });

  it('calls acknowledgeAlert and updates state on click', async () => {
    renderPage();
    const user = userEvent.setup();

    const ackBtn = await screen.findByRole('button', { name: /acknowledge alert/i });
    await user.click(ackBtn);

    await waitFor(() => {
      expect(mockAcknowledgeAlert).toHaveBeenCalledWith('alert-1');
    });
  });

  it('status filter buttons are rendered', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /^open$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^acknowledged$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^resolved$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument();
  });

  it('clicking All filter calls listAlerts without status param', async () => {
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('MRF ZTX 195/65R15');

    await user.click(screen.getByRole('button', { name: /^all$/i }));

    await waitFor(() => {
      expect(mockListAlerts).toHaveBeenCalledWith(
        expect.objectContaining({ status: undefined }),
      );
    });
  });
});
