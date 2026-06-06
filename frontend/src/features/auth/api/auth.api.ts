import { api } from '@/shared/api/client';
import type { LoginInput, LoginResponse } from '@/features/auth/types';

export async function login(data: LoginInput): Promise<LoginResponse> {
  const res = await api.post<{ success: boolean; data: LoginResponse }>('/auth/login', data);
  return res.data.data;
}

export async function logout(refreshToken: string): Promise<void> {
  // Best-effort — ignore errors (token may already be expired or revoked).
  await api.post('/auth/logout', { refreshToken }).catch(() => {});
}
