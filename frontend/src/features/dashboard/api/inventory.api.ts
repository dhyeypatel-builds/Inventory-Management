import { api } from '@/shared/api/client';

export interface LowStockItem {
  variantId: string;
  sku: string;
  productName: string;
  brandName: string | null;
  onHand: number;
  reorderLevel: number;
}

export async function getLowStockItems(pageSize = 8): Promise<LowStockItem[]> {
  // The inventory list returns the array directly in `data` (with `meta` alongside).
  const res = await api.get('/inventory', { params: { lowStock: true, pageSize } });
  return (res.data.data ?? []) as LowStockItem[];
}
