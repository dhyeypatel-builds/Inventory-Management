import { api } from '@/shared/api/client';
import type {
  InventoryItem,
  InventoryListResponse,
  MovementsResponse,
  AdjustStockInput,
  UpdateInventoryInput,
  Valuation,
} from '../types';

export interface ListInventoryParams {
  q?: string;
  lowStock?: boolean;
  rack?: string;
  page?: number;
  pageSize?: number;
}

/** Total cost value of stock on hand, with brand/category breakdowns. */
export async function getValuation(): Promise<Valuation> {
  const res = await api.get('/inventory/valuation');
  return res.data.data as Valuation;
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
