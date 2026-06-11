import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  searchVendors,
  createPurchase,
  listPurchases,
  getPurchase,
  type ListPurchasesParams,
} from '../api/purchases.api';
import type { CreatePurchasePayload } from '../types';

export const purchaseKeys = {
  all: ['purchases'] as const,
  list: (params: ListPurchasesParams) => ['purchases', 'list', params] as const,
  detail: (id: string) => ['purchases', 'detail', id] as const,
  vendors: (q: string) => ['vendors', 'search', q] as const,
};

export function usePurchases(params: ListPurchasesParams = {}) {
  return useQuery({
    queryKey: purchaseKeys.list(params),
    queryFn: () => listPurchases(params),
    staleTime: 30_000,
  });
}

export function usePurchase(id: string) {
  return useQuery({
    queryKey: purchaseKeys.detail(id),
    queryFn: () => getPurchase(id),
    staleTime: 30_000,
    enabled: !!id,
  });
}

export function useVendorSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: purchaseKeys.vendors(q),
    queryFn: () => searchVendors(q),
    staleTime: 15_000,
    enabled: enabled && q.length >= 2,
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePurchasePayload) => createPurchase(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: purchaseKeys.all });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
