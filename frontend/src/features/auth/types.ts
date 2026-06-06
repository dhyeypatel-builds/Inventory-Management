import type { AuthUser, TokenPair } from '@/app/providers';

export type { AuthUser, TokenPair };

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
