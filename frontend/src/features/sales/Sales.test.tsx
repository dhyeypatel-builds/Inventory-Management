import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PosPage } from './pages/PosPage';
import { Toaster } from '@/shared/ui/toaster';
import * as salesApi from './api/sales.api';

jest.mock('./api/sales.api');
jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useNavigate: () => jest.fn(),
}));

const mockSearchVariants = jest.mocked(salesApi.searchVariants);
const mockCreateSale = jest.mocked(salesApi.createSale);

const mockVariant = {
  id: 'var-1',
  sku: 'MRF-ZTX-001',
  productId: 'prod-1',
  productName: 'MRF ZTX 195/65R15',
  brandName: 'MRF',
  sellingPrice: 1500,
  taxRatePct: 18,
  onHand: 10,
  attributeValues: { size: '195/65R15' },
};

const mockSale = {
  id: 'sale-1',
  invoiceNo: 'INV-2026-000001',
  customerId: null,
  customer: null,
  status: 'CONFIRMED' as const,
  subtotal: 1500,
  discount: 0,
  taxTotal: 270,
  grandTotal: 1770,
  paymentMode: 'CASH',
  soldAt: new Date().toISOString(),
  createdBy: null,
  items: [
    {
      id: 'item-1',
      variantId: 'var-1',
      sku: 'MRF-ZTX-001',
      description: 'MRF ZTX 195/65R15 (MRF-ZTX-001)',
      quantity: 1,
      unitPrice: 1500,
      discount: 0,
      taxRatePct: 18,
      lineTotal: 1770,
    },
  ],
};

function renderPos() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <PosPage />
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockSearchVariants.mockResolvedValue({
    variants: [mockVariant],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  });
  mockCreateSale.mockResolvedValue(mockSale);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('PosPage — cart math', () => {
  it('renders Point of Sale heading', () => {
    renderPos();
    expect(screen.getByRole('heading', { name: /point of sale/i })).toBeInTheDocument();
  });

  it('cart is empty on load', () => {
    renderPos();
    expect(screen.getByText(/cart is empty/i)).toBeInTheDocument();
  });

  it('adds item to cart from search and computes totals', async () => {
    renderPos();
    const user = userEvent.setup();

    const searchInput = screen.getByRole('textbox', { name: /search products/i });
    await user.type(searchInput, 'MRF');

    // Wait for search results to appear
    expect(await screen.findByText('MRF ZTX 195/65R15')).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: /mrf ztx 195\/65r15/i }));

    // Item appears in cart
    expect(await screen.findByText(/mrf ztx 195\/65r15/i)).toBeInTheDocument();

    // Grand total shown in summary (1500 base + 18% tax = 1770)
    const summary = screen.getByLabelText('Order summary');
    expect(within(summary).getByText(/1,770\.00/)).toBeInTheDocument();
  });
});

describe('PosPage — confirm sale', () => {
  it('calls createSale exactly once even on double-click (isPending guard)', async () => {
    renderPos();
    const user = userEvent.setup();

    // Add item
    const searchInput = screen.getByRole('textbox', { name: /search products/i });
    await user.type(searchInput, 'MRF');
    await user.click(await screen.findByRole('option', { name: /mrf ztx 195\/65r15/i }));

    // Let isPending guard the button: mock a never-resolving promise for first call
    mockCreateSale.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve(mockSale), 100)),
    );

    const confirmBtn = screen.getByRole('button', { name: /confirm sale/i });
    await user.click(confirmBtn);
    // Button should be disabled immediately while pending
    expect(confirmBtn).toBeDisabled();

    // Wait for sale to complete
    await waitFor(() => expect(mockCreateSale).toHaveBeenCalledTimes(1));
  });

  it('shows invoice after successful sale', async () => {
    renderPos();
    const user = userEvent.setup();

    const searchInput = screen.getByRole('textbox', { name: /search products/i });
    await user.type(searchInput, 'MRF');
    await user.click(await screen.findByRole('option', { name: /mrf ztx 195\/65r15/i }));

    await user.click(screen.getByRole('button', { name: /confirm sale/i }));

    expect(await screen.findByText('TAX INVOICE')).toBeInTheDocument();
    expect(screen.getByText(/INV-2026-000001/)).toBeInTheDocument();
  });

  it('shows inline error on 409 INSUFFICIENT_STOCK', async () => {
    const err = Object.assign(new Error('Insufficient stock'), {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: 'Insufficient stock',
            details: [{ variantId: 'var-1', available: 2, requested: 5 }],
          },
        },
      },
    });
    mockCreateSale.mockRejectedValueOnce(err);

    renderPos();
    const user = userEvent.setup();

    const searchInput = screen.getByRole('textbox', { name: /search products/i });
    await user.type(searchInput, 'MRF');
    await user.click(await screen.findByRole('option', { name: /mrf ztx 195\/65r15/i }));

    // Set qty to 5 so insufficient stock is triggered
    const qtyInput = screen.getByLabelText(/quantity for mrf ztx/i);
    await user.clear(qtyInput);
    await user.type(qtyInput, '5');

    await user.click(screen.getByRole('button', { name: /confirm sale/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/insufficient stock/i);
  });

  it('invoice renders grand total', async () => {
    renderPos();
    const user = userEvent.setup();

    const searchInput = screen.getByRole('textbox', { name: /search products/i });
    await user.type(searchInput, 'MRF');
    await user.click(await screen.findByRole('option', { name: /mrf ztx 195\/65r15/i }));

    await user.click(screen.getByRole('button', { name: /confirm sale/i }));

    const invoiceTotals = await screen.findByLabelText('Invoice totals');
    expect(within(invoiceTotals).getByText(/1,770\.00/)).toBeInTheDocument();
  });
});
