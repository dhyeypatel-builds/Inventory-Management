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
  it('redirects an unauthenticated visit to "/" to the login screen', async () => {
    const router = renderAt('/');
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('renders the login screen directly without crashing', async () => {
    renderAt('/login');
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows the app shell with sidebar nav once authenticated', async () => {
    localStorage.setItem('ts_access', 'fake-access');
    localStorage.setItem('ts_refresh', 'fake-refresh');
    localStorage.setItem(
      'ts_user',
      JSON.stringify({ id: 'u1', fullName: 'Test Admin', email: 'a@b.c', role: 'ADMIN', permissions: [] }),
    );

    const router = renderAt('/');
    // Dashboard placeholder + sidebar nav links render.
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /products/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /stock alerts/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});
