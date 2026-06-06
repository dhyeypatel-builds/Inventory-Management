export interface InventoryItem {
  variantId: string;
  sku: string;
  productId: string;
  productName: string;
  brandName: string | null;
  onHand: number;
  reorderLevel: number;
  rackLocation: string | null;
  lowStock: boolean;
  sellingPrice: number;
  purchasePrice: number;
  attributeValues: Record<string, unknown>;
  updatedAt: string;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface Movement {
  id: string;
  type: string;
  quantityDelta: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface MovementsResponse {
  items: Movement[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AdjustStockInput {
  delta: number;
  reason: string;
  note?: string;
}

export interface UpdateInventoryInput {
  reorderLevel?: number;
  rackLocation?: string | null;
}
