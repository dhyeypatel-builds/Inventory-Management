import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InventoryListPage } from './pages/InventoryListPage';
import { Toaster } from '@/shared/ui/toaster';
import * as inventoryApi from './api/inventory.api';

jest.mock('./api/inventory.api');

const mockListInventory = jest.mocked(inventoryApi.listInventory);
const mockAdjustStock = jest.mocked(inventoryApi.adjustStock);
const mockListMovements = jest.mocked(inventoryApi.listMovements);

const makeItem = (overrides: Partial<inventoryApi.ListInventoryParams> & {
  variantId?: string;
  sku?: string;
  productName?: string;
  onHand?: number;
  reorderLevel?: number;
  lowStock?: boolean;
} = {}) => ({
  variantId: overrides.variantId ?? 'var-1',
  sku: overrides.sku ?? 'TYR-001',
  productId: 'prod-1',
  productName: overrides.productName ?? 'MRF STEEL 195/65R15',
  brandName: 'MRF',
  onHand: overrides.onHand ?? 10,
  reorderLevel: overrides.reorderLevel ?? 5,
  rackLocation: 'A1',
  lowStock: overrides.lowStock ?? false,
  sellingPrice: 1500,
  purchasePrice: 1200,
  attributeValues: { size: '195/65R15' },
  updatedAt: new Date().toISOString(),
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <InventoryListPage />
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockListInventory.mockResolvedValue({
    items: [makeItem()],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  });
  mockAdjustStock.mockResolvedValue(makeItem({ onHand: 15 }));
  mockListMovements.mockResolvedValue({
    items: [
      {
        id: 'mov-1',
        type: 'OPENING',
        quantityDelta: 10,
        balanceAfter: 10,
        referenceType: null,
        referenceId: null,
        note: 'Initial stock',
        createdBy: null,
        createdAt: new Date().toISOString(),
      },
    ],
    meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  });
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('InventoryListPage', () => {
  it('renders the Inventory heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /inventory/i })).toBeInTheDocument();
  });

  it('shows inventory items in the table', async () => {
    renderPage();
    expect(await screen.findByText('MRF STEEL 195/65R15')).toBeInTheDocument();
    expect(screen.getByText('TYR-001')).toBeInTheDocument();
  });

  it('low-stock filter calls API with lowStock param', async () => {
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('MRF STEEL 195/65R15');

    const checkbox = screen.getByRole('checkbox', { name: /low stock only/i });
    await user.click(checkbox);

    await waitFor(() => {
      expect(mockListInventory).toHaveBeenCalledWith(
        expect.objectContaining({ lowStock: true }),
      );
    });
  });

  it('opens adjust dialog and submits delta + reason', async () => {
    renderPage();
    const user = userEvent.setup();

    const adjustBtn = await screen.findByRole('button', { name: /adjust stock for TYR-001/i });
    await user.click(adjustBtn);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const deltaInput = screen.getByLabelText(/delta/i);
    await user.clear(deltaInput);
    await user.type(deltaInput, '5');

    const reasonInput = screen.getByLabelText(/reason/i);
    await user.type(reasonInput, 'Purchase');

    await user.click(screen.getByRole('button', { name: /save adjustment/i }));

    await waitFor(() => {
      expect(mockAdjustStock).toHaveBeenCalledWith(
        'var-1',
        expect.objectContaining({ delta: 5, reason: 'Purchase' }),
      );
    });

    expect(await screen.findByText(/stock adjusted/i)).toBeInTheDocument();
  });

  it('opens ledger drawer and renders movements', async () => {
    renderPage();
    const user = userEvent.setup();

    const ledgerBtn = await screen.findByRole('button', { name: /view movements for TYR-001/i });
    await user.click(ledgerBtn);

    expect(await screen.findByText('Movement Ledger')).toBeInTheDocument();
    expect(await screen.findByText('Initial stock')).toBeInTheDocument();
  });

  it('shows loading skeletons while fetching', () => {
    mockListInventory.mockImplementation(() => new Promise(() => {}));
    renderPage();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
