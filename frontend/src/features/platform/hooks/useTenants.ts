import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listTenants,
  getTenant,
  provisionTenant,
  suspendTenant,
  reactivateTenant,
  impersonateTenant,
} from '../api/platform.api';
import type { ProvisionInput, TenantStatus } from '../types';

const KEY = ['platform', 'tenants'] as const;

export function useTenants(filters: { status?: TenantStatus; q?: string }) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () => listTenants(filters),
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    queryFn: () => getTenant(id),
    enabled: !!id,
  });
}

export function useProvisionTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProvisionInput) => provisionTenant(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSuspendTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => suspendTenant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useReactivateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reactivateTenant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useImpersonateTenant() {
  return useMutation({
    mutationFn: (id: string) => impersonateTenant(id),
  });
}
