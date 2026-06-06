import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listInventory,
  getInventoryItem,
  updateInventory,
  adjustStock,
  listMovements,
  type ListInventoryParams,
} from '../api/inventory.api';
import type { AdjustStockInput, UpdateInventoryInput } from '../types';

export const inventoryKeys = {
  all: ['inventory'] as const,
  list: (params: ListInventoryParams) => ['inventory', 'list', params] as const,
  detail: (variantId: string) => ['inventory', 'detail', variantId] as const,
  movements: (variantId: string, page: number) =>
    ['inventory', 'movements', variantId, page] as const,
};

export function useInventory(params: ListInventoryParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.list(params),
    queryFn: () => listInventory(params),
    staleTime: 30_000,
  });
}

export function useInventoryItem(variantId: string) {
  return useQuery({
    queryKey: inventoryKeys.detail(variantId),
    queryFn: () => getInventoryItem(variantId),
    staleTime: 30_000,
    enabled: !!variantId,
  });
}

export function useMovements(variantId: string, page = 1, enabled = false) {
  return useQuery({
    queryKey: inventoryKeys.movements(variantId, page),
    queryFn: () => listMovements(variantId, page),
    staleTime: 30_000,
    enabled: enabled && !!variantId,
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, data }: { variantId: string; data: AdjustStockInput }) =>
      adjustStock(variantId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useUpdateInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, data }: { variantId: string; data: UpdateInventoryInput }) =>
      updateInventory(variantId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}
