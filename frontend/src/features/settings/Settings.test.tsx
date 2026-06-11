import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/app/providers';
import { SettingsPage } from './pages/SettingsPage';
import * as settingsApi from './api/settings.api';
import * as teamApi from './api/team.api';
import { seedAuthedSession } from '../../../test/fixtures';

jest.mock('./api/settings.api');
jest.mock('./api/team.api', () => ({
  ...jest.requireActual('./api/team.api'),
  listTeam: jest.fn(),
  inviteStaff: jest.fn(),
  revokeInvite: jest.fn(),
  setMemberActive: jest.fn(),
}));

const mockListTeam = jest.mocked(teamApi.listTeam);

const mockGetSettings = jest.mocked(settingsApi.getSettings);
const mockUpdateSettings = jest.mocked(settingsApi.updateSettings);
const mockListBrands = jest.mocked(settingsApi.listBrands);
const mockListCategories = jest.mocked(settingsApi.listCategories);

const mockSettings = {
  company: {
    name: 'TyreStock Auto',
    phone: '+44 7700 900000',
    address: '1 Tyre Street',
    vat_number: 'GB123456789',
  },
  tax: { default_pct: 20 },
  inventory: { default_reorder_level: 5 },
};

const mockBrands = [
  { id: 1, name: 'MRF', isActive: true, createdAt: new Date().toISOString() },
  { id: 2, name: 'Apollo', isActive: true, createdAt: new Date().toISOString() },
];

const mockCategories = [
  { id: 1, name: 'Car Tyres', slug: 'car-tyres', parentId: null, isActive: true },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  seedAuthedSession();
  mockGetSettings.mockResolvedValue(mockSettings);
  mockUpdateSettings.mockResolvedValue(mockSettings);
  mockListBrands.mockResolvedValue(mockBrands);
  mockListCategories.mockResolvedValue(mockCategories);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('SettingsPage', () => {
  it('renders the Settings heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });

  it('renders tab buttons for all sections', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /^company$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tax & inventory/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^brands$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^categories$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^team$/i })).toBeInTheDocument();
  });

  it('hides the Team tab from users without team:manage', () => {
    seedAuthedSession({ permissions: ['settings:read', 'settings:write'] });
    renderPage();
    expect(screen.queryByRole('tab', { name: /^team$/i })).not.toBeInTheDocument();
  });

  it('shows team members and pending invites on the Team tab', async () => {
    mockListTeam.mockResolvedValue({
      members: [
        {
          id: 'u1', fullName: 'Test Admin', email: 'a@b.c', roleName: 'ADMIN',
          isActive: true, lastLoginAt: '2026-06-01T00:00:00Z', pending: false,
        },
        {
          id: 'u2', fullName: 'Casey Counter', email: 'casey@shop.co.uk', roleName: 'SALES',
          isActive: true, lastLoginAt: null, pending: true,
        },
      ],
      invites: [
        {
          id: 'i1', email: 'casey@shop.co.uk', roleName: 'SALES',
          expiresAt: '2026-06-18T00:00:00Z', createdAt: '2026-06-11T00:00:00Z',
        },
      ],
    });

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /^team$/i }));

    expect(await screen.findByText('Casey Counter')).toBeInTheDocument();
    expect(screen.getByText(/pending invites/i)).toBeInTheDocument();
    // The current user can't deactivate themselves; others get the action.
    expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
  });

  it('loads and displays company name in the form', async () => {
    renderPage();
    expect(await screen.findByDisplayValue('TyreStock Auto')).toBeInTheDocument();
  });

  it('save company settings calls updateSettings with correct payload', async () => {
    renderPage();
    const user = userEvent.setup();

    const nameInput = await screen.findByLabelText(/company name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'New Company Name');

    await user.click(screen.getByRole('button', { name: /save company settings/i }));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          company: expect.objectContaining({ name: 'New Company Name' }),
        }),
      );
    });
  });

  it('invalid tax % greater than 100 shows validation error and does not call API', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: /tax & inventory/i }));

    const taxInput = await screen.findByLabelText(/default tax rate/i);
    await user.clear(taxInput);
    await user.type(taxInput, '150');

    await user.click(screen.getByRole('button', { name: /save tax settings/i }));

    expect(await screen.findByText(/maximum is 100/i)).toBeInTheDocument();
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it('save tax settings calls updateSettings with tax payload', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: /tax & inventory/i }));

    const taxInput = await screen.findByLabelText(/default tax rate/i);
    await user.clear(taxInput);
    await user.type(taxInput, '12');

    await user.click(screen.getByRole('button', { name: /save tax settings/i }));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ tax: { default_pct: 12 } }),
      );
    });
  });

  it('renders brand list in the Brands tab', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: /^brands$/i }));

    expect(await screen.findByText('MRF')).toBeInTheDocument();
    expect(screen.getByText('Apollo')).toBeInTheDocument();
  });

  it('renders category list in the Categories tab', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: /^categories$/i }));

    expect(await screen.findByText('Car Tyres')).toBeInTheDocument();
  });
});
