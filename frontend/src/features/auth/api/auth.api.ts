import { api } from '@/shared/api/client';
import type { AuthUser } from '@/app/providers';
import type { LoginInput } from '@/features/auth/types';

interface SessionResponse {
  accessToken: string;
  user: AuthUser;
}

export async function login(data: LoginInput): Promise<SessionResponse> {
  const res = await api.post<{ data: SessionResponse }>('/auth/login', data);
  return res.data.data;
}

/** Request an OTP code for an email. Always resolves (enumeration-safe). */
export async function requestOtp(email: string): Promise<void> {
  await api.post('/auth/otp/request', { email });
}

export async function verifyOtp(email: string, code: string): Promise<SessionResponse> {
  const res = await api.post<{ data: SessionResponse }>('/auth/otp/verify', { email, code });
  return res.data.data;
}

export async function logout(): Promise<void> {
  // Best-effort — clears the server refresh cookie. Cookie carries the token.
  await api.post('/auth/logout', {}).catch(() => {});
}

/**
 * Changes (or, for passwordless invited users, sets) the account password.
 * The server revokes all refresh tokens, so other devices sign out shortly.
 */
export async function changePassword(input: {
  currentPassword?: string;
  newPassword: string;
}): Promise<void> {
  await api.post('/auth/change-password', input);
}

export interface InviteDetails {
  email: string;
  tenantName: string;
  roleName: string;
  expiresAt: string;
}

export async function getInvite(token: string): Promise<InviteDetails> {
  const res = await api.get<{ data: InviteDetails }>(`/auth/invite/${token}`);
  return res.data.data;
}
