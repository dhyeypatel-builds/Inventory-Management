import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { Providers } from '@/app/providers';
import * as authApi from '@/features/auth/api/auth.api';

jest.mock('@/features/auth/api/auth.api');
const mockLogin = jest.mocked(authApi.login);

function renderLogin() {
  const router = createMemoryRouter(routes, { initialEntries: ['/login'] });
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

describe('LoginForm', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows a validation error for an invalid email', async () => {
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/^password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  });

  it('shows a validation error when the password is empty', async () => {
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'admin@example.com');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/password required/i)).toBeInTheDocument();
  });

  it('offers an OTP fallback (email me a sign-in code)', async () => {
    renderLogin();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /email me a sign-in code/i }));

    // Switches to the OTP flow.
    expect(await screen.findByRole('button', { name: /email me a code/i })).toBeInTheDocument();
  });

  it('redirects to the dashboard on successful login', async () => {
    mockLogin.mockResolvedValueOnce({
      accessToken: 'access-token',
      user: {
        id: 'u1',
        tenantId: 't1',
        tenantName: 'Test Shop',
        onboardingCompletedAt: '2026-01-01T00:00:00Z',
        fullName: 'Test Admin',
        email: 'admin@example.com',
        role: 'ADMIN',
        permissions: [],
      },
    });

    const router = renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'admin@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard');
    });

    // Dashboard placeholder is visible after redirect.
    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('shows a server error message on failed login', async () => {
    mockLogin.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 401,
        data: { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
      },
    });

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'admin@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it('shows a generic error when the server response has no message', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network Error'));

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'admin@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('does not redirect when already authenticated', () => {
    localStorage.setItem('ts_access', 'existing-token');
    localStorage.setItem('ts_refresh', 'existing-refresh');
    localStorage.setItem(
      'ts_user',
      JSON.stringify({ id: 'u1', tenantId: 't1', tenantName: 'Shop', onboardingCompletedAt: '2026-01-01T00:00:00Z', fullName: 'Admin', email: 'a@b.com', role: 'ADMIN', permissions: [] }),
    );

    const router = renderLogin();
    // AuthProvider reads stored user → isAuthenticated = true → LoginPage redirects to /dashboard
    expect(router.state.location.pathname).toBe('/dashboard');
  });
});
