export interface PlatformAdmin {
  id: string;
  email: string;
  fullName: string;
  lastLoginAt: string | null;
}

export type TenantStatus = 'ACTIVE' | 'SUSPENDED';

export interface TenantUsage {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: string;
  createdAt: string;
  onboardingCompletedAt: string | null;
  skuCount: number;
  customerCount: number;
  sales30d: number;
  lastSaleAt: string | null;
}

export interface ProvisionInput {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerName: string;
}

export interface ProvisionResult {
  tenant: { id: string; name: string; slug: string };
  owner: { id: string; email: string };
  invite: { token: string; path: string; expiresAt: string };
}

export interface ImpersonateResult {
  accessToken: string;
  tenant: { id: string; name: string };
}
