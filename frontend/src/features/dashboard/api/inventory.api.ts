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
  const res = await api.get('/inventory', { params: { lowStock: true, pageSize } });
  return res.data.data.items as LowStockItem[];
}
