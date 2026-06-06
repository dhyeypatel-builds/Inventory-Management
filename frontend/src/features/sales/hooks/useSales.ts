import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  searchVariants,
  createSale,
  getSale,
  listSales,
  cancelSale,
  searchCustomers,
  type SearchVariantsParams,
  type ListSalesParams,
} from '../api/sales.api';
import type { CreateSalePayload } from '../types';

export const salesKeys = {
  all: ['sales'] as const,
  list: (params: ListSalesParams) => ['sales', 'list', params] as const,
  detail: (id: string) => ['sales', 'detail', id] as const,
  variants: (params: SearchVariantsParams) => ['variants', 'search', params] as const,
  customers: (q: string) => ['customers', 'search', q] as const,
};

export function useSales(params: ListSalesParams = {}) {
  return useQuery({
    queryKey: salesKeys.list(params),
    queryFn: () => listSales(params),
    staleTime: 30_000,
  });
}

export function useSale(id: string) {
  return useQuery({
    queryKey: salesKeys.detail(id),
    queryFn: () => getSale(id),
    staleTime: 30_000,
    enabled: !!id,
  });
}

export function useVariantSearch(params: SearchVariantsParams, enabled: boolean) {
  return useQuery({
    queryKey: salesKeys.variants(params),
    queryFn: () => searchVariants(params),
    staleTime: 15_000,
    enabled: enabled && !!(params.q || params.size),
  });
}

export function useCustomerSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: salesKeys.customers(q),
    queryFn: () => searchCustomers(q),
    staleTime: 15_000,
    enabled: enabled && q.length >= 2,
  });
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CreateSalePayload;
      idempotencyKey: string;
    }) => createSale(payload, idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesKeys.all });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useCancelSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelSale(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesKeys.all });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
