export type SaleStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'RETURNED';
export type PaymentMode = 'CASH' | 'CARD' | 'BANK_TRANSFER';

export interface VariantSearchResult {
  id: string;
  sku: string;
  productId: string;
  productName: string;
  brandName: string | null;
  sellingPrice: number;
  taxRatePct: number;
  onHand: number;
  attributeValues: Record<string, unknown>;
}

export interface VariantSearchResponse {
  variants: VariantSearchResult[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// A line in the active cart (client-side only)
export interface CartItem {
  variantId: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRatePct: number;
}

export interface SaleItemDetail {
  id: string;
  variantId: string;
  sku: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRatePct: number;
  lineTotal: number;
}

export interface SaleDetail {
  id: string;
  invoiceNo: string;
  customerId: string | null;
  customer: { id: string; name: string; phone: string | null } | null;
  status: SaleStatus;
  subtotal: number;
  discount: number;
  taxTotal: number;
  grandTotal: number;
  paymentMode: string | null;
  soldAt: string;
  createdBy: string | null;
  items: SaleItemDetail[];
}

export interface SaleListItem {
  id: string;
  invoiceNo: string;
  customerId: string | null;
  customerName: string | null;
  status: SaleStatus;
  grandTotal: number;
  paymentMode: string | null;
  soldAt: string;
  itemCount: number;
}

export interface SaleListResponse {
  items: SaleListItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateSalePayload {
  customerId?: string;
  paymentMode: PaymentMode;
  items: {
    variantId: string;
    quantity: number;
    unitPrice?: number;
    discount: number;
  }[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface CustomerListResponse {
  customers: Customer[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
