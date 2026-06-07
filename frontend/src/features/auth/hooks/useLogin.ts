import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useAuth, type AuthUser } from '@/app/providers';
import { login as loginApi, verifyOtp as verifyOtpApi } from '@/features/auth/api/auth.api';
import type { LoginInput } from '@/features/auth/types';

/** After any successful sign-in, route to onboarding or the dashboard. */
function useOnAuthSuccess() {
  const { login } = useAuth();
  const navigate = useNavigate();
  return ({ accessToken, user }: { accessToken: string; user: AuthUser }) => {
    login(accessToken, user);
    // Unfinished shops land in the setup wizard; finished ones on the dashboard.
    navigate(user.onboardingCompletedAt ? '/dashboard' : '/welcome', { replace: true });
  };
}

/** Password sign-in. */
export function useLogin() {
  const onSuccess = useOnAuthSuccess();
  return useMutation({
    mutationFn: (data: LoginInput) => loginApi(data),
    onSuccess,
  });
}

/** OTP verification → session. */
export function useVerifyOtp() {
  const onSuccess = useOnAuthSuccess();
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) => verifyOtpApi(email, code),
    onSuccess,
  });
}
