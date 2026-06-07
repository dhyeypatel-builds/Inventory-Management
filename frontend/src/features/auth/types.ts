import type { AuthUser } from '@/app/providers';

export type { AuthUser };

export interface LoginInput {
  email: string;
  password: string;
}
