import { platformApi, platformTokenStore } from './platformClient';
import type {
  PlatformAdmin,
  TenantUsage,
  ProvisionInput,
  ProvisionResult,
  ImpersonateResult,
  TenantStatus,
} from '../types';

interface Envelope<T> {
  success: boolean;
  data: T;
}

export interface PlatformLoginResult {
  accessToken: string;
  admin: { id: string; email: string; fullName: string };
}

export async function platformLogin(email: string, password: string): Promise<PlatformLoginResult> {
  const res = await platformApi.post<Envelope<PlatformLoginResult>>('/auth/login', {
    email,
    password,
  });
  return res.data.data;
}

export async function getPlatformMe(): Promise<PlatformAdmin> {
  const res = await platformApi.get<Envelope<PlatformAdmin>>('/auth/me');
  return res.data.data;
}

export async function listTenants(params: { status?: TenantStatus; q?: string } = {}): Promise<
  TenantUsage[]
> {
  const res = await platformApi.get<Envelope<TenantUsage[]>>('/tenants', { params });
  return res.data.data;
}

export async function getTenant(id: string): Promise<TenantUsage> {
  const res = await platformApi.get<Envelope<TenantUsage>>(`/tenants/${id}`);
  return res.data.data;
}

export async function provisionTenant(input: ProvisionInput): Promise<ProvisionResult> {
  const res = await platformApi.post<Envelope<ProvisionResult>>('/tenants', input);
  return res.data.data;
}

export async function suspendTenant(id: string): Promise<TenantUsage> {
  const res = await platformApi.post<Envelope<TenantUsage>>(`/tenants/${id}/suspend`);
  return res.data.data;
}

export async function reactivateTenant(id: string): Promise<TenantUsage> {
  const res = await platformApi.post<Envelope<TenantUsage>>(`/tenants/${id}/reactivate`);
  return res.data.data;
}

export async function impersonateTenant(id: string): Promise<ImpersonateResult> {
  const res = await platformApi.post<Envelope<ImpersonateResult>>(`/tenants/${id}/impersonate`);
  return res.data.data;
}

export { platformTokenStore };
