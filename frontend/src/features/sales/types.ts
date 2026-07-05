export type SaleStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'RETURNED';
export type PaymentMode = 'CASH' | 'CARD' | 'BANK_TRANSFER';

export interface VariantSearchResult {
  id: string;
  sku: string;
  productId: string;
  productName: string;
  brandName: string | null;
  purchasePrice: number;
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
  /** Catalogue selling price; unitPrice diverges from it on a manual override. */
  listPrice: number;
  discount: number;
  taxRatePct: number;
  /** Optional comma-separated serial numbers being sold (warranty tracing). */
  serialsText?: string;
}

export interface SaleItemDetail {
  id: string;
  variantId: string;
  sku: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Catalogue price at sale time; differs from unitPrice when overridden. Null on legacy rows. */
  listPrice?: number | null;
  discount: number;
  taxRatePct: number;
  lineTotal: number;
}

export interface InvoiceCompany {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  vat_number?: string;
  /** Legacy keys kept for backward compatibility with older payloads. */
  gstin?: string;
  vat_no?: string;
  logo_url?: string;
}

export interface SaleDetail {
  id: string;
  invoiceNo: string;
  customerId: string | null;
  customer: { id: string; name: string; phone: string | null } | null;
  /** Buyer snapshot — set for walk-ins (no linked customer) and linked sales alike. */
  customerName?: string | null;
  customerEmail?: string | null;
  status: SaleStatus;
  subtotal: number;
  discount: number;
  taxTotal: number;
  grandTotal: number;
  paymentMode: string | null;
  soldAt: string;
  createdBy: string | null;
  items: SaleItemDetail[];
  /** Present only on the /sales/:id/invoice payload. */
  company?: InvoiceCompany;
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
  /** Walk-in buyer name (when no saved customer is linked). */
  customerName?: string;
  /** Walk-in buyer email (when no saved customer is linked). */
  customerEmail?: string;
  paymentMode: PaymentMode;
  items: {
    variantId: string;
    quantity: number;
    unitPrice?: number;
    discount: number;
    serials?: string[];
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
