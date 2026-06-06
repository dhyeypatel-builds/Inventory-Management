import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { Providers } from '@/app/providers';
import { AppShell } from './AppShell';
import { BREAKPOINTS } from '@/shared/hooks/useMediaQuery';

type Variant = 'mobile' | 'tablet' | 'desktop';

function mockBreakpoint(active: Variant): void {
  window.matchMedia = ((query: string) => ({
    matches:
      (active === 'mobile' && query === BREAKPOINTS.mobile) ||
      (active === 'tablet' && query === BREAKPOINTS.tablet),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function renderShell(): void {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [{ index: true, element: <div>Home content</div> }],
      },
    ],
    { initialEntries: ['/'] },
  );
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
}

afterEach(() => {
  // Restore the default (matches: false) stub from test/setup.ts.
  mockBreakpoint('desktop');
});

describe('AppShell responsive navigation', () => {
  it('desktop: renders the persistent sidebar and no hamburger', () => {
    mockBreakpoint('desktop');
    renderShell();

    // The sidebar shows the brand wordmark; tablet drawer/mobile bottom-nav do not.
    expect(screen.getByText('TyreStock')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /products/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open navigation/i })).not.toBeInTheDocument();
  });

  it('tablet: hides the sidebar behind a hamburger that opens a drawer', async () => {
    mockBreakpoint('tablet');
    renderShell();

    const menuButton = screen.getByRole('button', { name: /open navigation/i });
    expect(menuButton).toBeInTheDocument();
    // Sidebar is collapsed until the drawer is opened.
    expect(screen.queryByText('TyreStock')).not.toBeInTheDocument();

    await userEvent.click(menuButton);

    expect(screen.getByText('TyreStock')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /products/i })).toBeInTheDocument();
  });

  it('mobile: renders the bottom navigation bar instead of the sidebar', () => {
    mockBreakpoint('mobile');
    renderShell();

    // Bottom nav exposes the same destinations as links...
    expect(screen.getByRole('link', { name: /products/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /stock alerts/i })).toBeInTheDocument();
    // ...but without the sidebar wordmark or the tablet hamburger.
    expect(screen.queryByText('TyreStock')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open navigation/i })).not.toBeInTheDocument();
  });
});
