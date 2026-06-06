import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerListPage } from './pages/CustomerListPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import * as customersApi from './api/customers.api';

jest.mock('./api/customers.api');
jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useNavigate: () => jest.fn(),
  useParams: () => ({ id: 'cust-1' }),
}));

const mockListCustomers = jest.mocked(customersApi.listCustomers);
const mockCreateCustomer = jest.mocked(customersApi.createCustomer);
const mockGetCustomer = jest.mocked(customersApi.getCustomer);

const mockCustomer = {
  id: 'cust-1',
  name: 'James Patel',
  phone: '+44 7911 123456',
  email: 'james@example.com',
  vatNumber: null,
  address: '123 High Street',
  vehicleNo: 'AB12 CDE',
  notes: null,
  createdAt: new Date().toISOString(),
  deletedAt: null,
};

const mockListResponse = {
  customers: [mockCustomer],
  meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
};

const mockDetailResponse = {
  ...mockCustomer,
  recentSales: [
    {
      id: 'sale-1',
      invoiceNo: 'INV-2026-000001',
      status: 'CONFIRMED',
      grandTotal: 3540,
      paymentMode: 'CASH',
      soldAt: new Date().toISOString(),
    },
  ],
};

function renderListPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CustomerListPage />
    </QueryClientProvider>,
  );
}

function renderDetailPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CustomerDetailPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockListCustomers.mockResolvedValue(mockListResponse);
  mockCreateCustomer.mockResolvedValue(mockCustomer);
  mockGetCustomer.mockResolvedValue(mockDetailResponse);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('CustomerListPage', () => {
  it('renders the Customers heading', () => {
    renderListPage();
    expect(screen.getByRole('heading', { name: /customers/i })).toBeInTheDocument();
  });

  it('renders customer rows after load', async () => {
    renderListPage();
    expect(await screen.findByText('James Patel')).toBeInTheDocument();
    expect(screen.getByText('+44 7911 123456')).toBeInTheDocument();
  });

  it('search input triggers API call with q param', async () => {
    renderListPage();
    const user = userEvent.setup();

    await screen.findByText('James Patel');

    const searchInput = screen.getByRole('textbox', { name: /search customers/i });
    await user.type(searchInput, 'James');

    await waitFor(() => {
      expect(mockListCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'James' }),
      );
    });
  });

  it('opens new customer dialog on button click', async () => {
    renderListPage();
    const user = userEvent.setup();

    await screen.findByText('James Patel');

    await user.click(screen.getByRole('button', { name: /new customer/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /new customer/i })).toBeInTheDocument();
  });

  it('shows validation error when name is empty on submit', async () => {
    renderListPage();
    const user = userEvent.setup();

    await screen.findByText('James Patel');
    await user.click(screen.getByRole('button', { name: /new customer/i }));
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: /create customer/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });
});

describe('CustomerDetailPage', () => {
  it('renders customer name as heading', async () => {
    renderDetailPage();
    expect(await screen.findByRole('heading', { name: /james patel/i })).toBeInTheDocument();
  });

  it('renders purchase history table', async () => {
    renderDetailPage();
    expect(await screen.findByText('INV-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
  });
});
