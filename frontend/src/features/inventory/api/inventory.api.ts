import { api } from '@/shared/api/client';
import type {
  InventoryItem,
  InventoryListResponse,
  MovementsResponse,
  AdjustStockInput,
  UpdateInventoryInput,
} from '../types';

export interface ListInventoryParams {
  q?: string;
  lowStock?: boolean;
  rack?: string;
  page?: number;
  pageSize?: number;
}

export async function listInventory(params: ListInventoryParams = {}): Promise<InventoryListResponse> {
  const res = await api.get('/inventory', { params });
  return { items: res.data.data, meta: res.data.meta } as InventoryListResponse;
}

export async function getInventoryItem(variantId: string): Promise<InventoryItem> {
  const res = await api.get(`/inventory/${variantId}`);
  return res.data.data as InventoryItem;
}

export async function updateInventory(
  variantId: string,
  data: UpdateInventoryInput,
): Promise<InventoryItem> {
  const res = await api.patch(`/inventory/${variantId}`, data);
  return res.data.data as InventoryItem;
}

export async function adjustStock(
  variantId: string,
  data: AdjustStockInput,
): Promise<InventoryItem> {
  const res = await api.post(`/inventory/${variantId}/adjust`, data);
  return res.data.data as InventoryItem;
}

export async function listMovements(
  variantId: string,
  page = 1,
  pageSize = 20,
): Promise<MovementsResponse> {
  const res = await api.get(`/inventory/${variantId}/movements`, {
    params: { page, pageSize },
  });
  return { items: res.data.data, meta: res.data.meta } as MovementsResponse;
}
