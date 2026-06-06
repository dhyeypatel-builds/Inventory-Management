import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useAuth } from '@/app/providers';
import { login as loginApi } from '@/features/auth/api/auth.api';
import type { LoginInput } from '@/features/auth/types';

/** Calls /auth/login, stores tokens + user, then navigates to the dashboard. */
export function useLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: LoginInput) => loginApi(data),
    onSuccess: ({ accessToken, refreshToken, user }) => {
      login({ accessToken, refreshToken }, user);
      navigate('/dashboard', { replace: true });
    },
  });
}
