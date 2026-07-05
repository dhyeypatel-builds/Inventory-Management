import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ProductFormPage } from './pages/ProductFormPage';
import { Toaster } from '@/shared/ui/toaster';
import * as productsApi from './api/products.api';

jest.mock('./api/products.api');
// react-router navigation mock — suppress the actual navigate() call
jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useNavigate: () => jest.fn(),
}));

const mockListTypes = jest.mocked(productsApi.listProductTypes);
const mockGetAttributes = jest.mocked(productsApi.getProductTypeAttributes);
const mockListBrands = jest.mocked(productsApi.listBrands);
const mockListCategories = jest.mocked(productsApi.listCategories);
const mockCreateProduct = jest.mocked(productsApi.createProduct);

const carTyreType = { id: 1, name: 'Tyre', isStockable: true, isActive: true };

const tyreAttributes = [
  {
    id: 1,
    productTypeId: 1,
    code: 'size',
    label: 'Size',
    datatype: 'TEXT' as const,
    isRequired: true,
    isVariantDefining: true,
    displayOrder: 0,
    options: [],
  },
  {
    id: 2,
    productTypeId: 1,
    code: 'tyre_type',
    label: 'Tyre Type',
    datatype: 'ENUM' as const,
    isRequired: true,
    isVariantDefining: true,
    displayOrder: 1,
    options: [
      { id: 1, value: 'Radial', displayOrder: 0 },
      { id: 2, value: 'Bias', displayOrder: 1 },
    ],
  },
];

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/', element: <ProductFormPage /> }], {
    initialEntries: ['/'],
  });
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  return { qc };
}

beforeEach(() => {
  mockListTypes.mockResolvedValue([carTyreType]);
  mockGetAttributes.mockResolvedValue(tyreAttributes);
  mockListBrands.mockResolvedValue([{ id: 1, name: 'MRF', isActive: true }]);
  mockListCategories.mockResolvedValue([]);
  mockCreateProduct.mockResolvedValue({} as ReturnType<typeof productsApi.createProduct> extends Promise<infer T> ? T : never);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('ProductForm', () => {
  it('renders the New Product heading', () => {
    renderForm();
    expect(screen.getByRole('heading', { name: /new product/i })).toBeInTheDocument();
  });

  it('shows attribute fields after selecting a product type', async () => {
    renderForm();
    const user = userEvent.setup();

    // Wait for the product type select to populate
    await waitFor(() => expect(mockListTypes).toHaveBeenCalled());

    // Open the product type select and choose Tyre
    const typeSelect = await screen.findByRole('combobox', { name: /product type/i });
    await user.click(typeSelect);
    await user.click(await screen.findByRole('option', { name: /^tyre$/i }));

    // Attributes should now appear (Size and Tyre Type)
    expect(await screen.findByLabelText(/size/i)).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: /tyre type/i })).toBeInTheDocument();
  });

  it('blocks submit when a required attribute is missing', async () => {
    renderForm();
    const user = userEvent.setup();

    // Select product type
    await waitFor(() => expect(mockListTypes).toHaveBeenCalled());
    const typeSelect = await screen.findByRole('combobox', { name: /product type/i });
    await user.click(typeSelect);
    await user.click(await screen.findByRole('option', { name: /^tyre$/i }));

    // Fill in product name and SKU but skip required attributes
    await user.type(await screen.findByLabelText(/product name/i), 'MRF ZTX 195/65R15');
    await user.clear(await screen.findByLabelText(/sku/i));
    await user.type(await screen.findByLabelText(/sku/i), 'MRF-ZTX-001');

    // Submit without filling attributes
    await user.click(screen.getByRole('button', { name: /save product/i }));

    // Form should stay on page (createProduct not called)
    expect(mockCreateProduct).not.toHaveBeenCalled();
  });

  it('calls createProduct and shows success toast on valid submission', async () => {
    mockCreateProduct.mockResolvedValueOnce({
      id: 'prod-1',
      name: 'MRF ZTX 195/65R15',
    } as ReturnType<typeof productsApi.createProduct> extends Promise<infer T> ? T : never);

    renderForm();
    const user = userEvent.setup();

    // Select product type
    await waitFor(() => expect(mockListTypes).toHaveBeenCalled());
    const typeSelect = await screen.findByRole('combobox', { name: /product type/i });
    await user.click(typeSelect);
    await user.click(await screen.findByRole('option', { name: /^tyre$/i }));

    // Fill required product fields
    await user.type(await screen.findByLabelText(/product name/i), 'MRF ZTX 195/65R15');

    // Fill required variant fields
    await user.clear(await screen.findByLabelText(/sku/i));
    await user.type(await screen.findByLabelText(/sku/i), 'MRF-ZTX-001');

    const purchaseInput = screen.getByLabelText(/purchase price/i);
    await user.clear(purchaseInput);
    await user.type(purchaseInput, '1200');

    const sellingInput = screen.getByLabelText(/selling price/i);
    await user.clear(sellingInput);
    await user.type(sellingInput, '1500');

    // Fill required attributes
    const sizeInput = await screen.findByLabelText(/^size/i);
    await user.type(sizeInput, '195/65R15');

    const tyreTypeSelect = await screen.findByRole('combobox', { name: /tyre type/i });
    await user.click(tyreTypeSelect);
    await user.click(await screen.findByRole('option', { name: /radial/i }));

    // Submit
    await user.click(screen.getByRole('button', { name: /save product/i }));

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalled();
    });

    // Toast rendered
    expect(await screen.findByText(/product created/i)).toBeInTheDocument();
  });
});
