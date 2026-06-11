import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { routes } from '@/app/router';
import { Providers } from '@/app/providers';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

describe('App routing', () => {
  it('shows the public landing page on an unauthenticated visit to "/"', async () => {
    const router = renderAt('/');
    expect((await screen.findAllByRole('link', { name: /sign in/i })).length).toBeGreaterThan(0);
    expect(router.state.location.pathname).toBe('/');
  });

  it('renders the login screen directly without crashing', async () => {
    renderAt('/login');
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('redirects an authenticated visit to "/" into the dashboard shell', async () => {
    localStorage.setItem('ts_access', 'fake-access');
    localStorage.setItem('ts_refresh', 'fake-refresh');
    localStorage.setItem(
      'ts_user',
      JSON.stringify({ id: 'u1', tenantId: 't1', tenantName: 'Shop', onboardingCompletedAt: '2026-01-01T00:00:00Z', fullName: 'Test Admin', email: 'a@b.c', role: 'ADMIN', permissions: [] }),
    );

    const router = renderAt('/');
    // PublicRoot redirects authenticated users to /dashboard: shell + nav render.
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /products/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /stock alerts/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
  });
});
