export interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  vatNumber?: string | null;
  address?: string | null;
  notes?: string | null;
}

export type PurchaseStatus = 'RECEIVED' | 'CANCELLED';
export type SerialStatus = 'IN_STOCK' | 'SOLD' | 'RETURNED' | 'DOA';

/** A line in the purchase entry form. Serials are kept as raw comma-separated text while editing. */
export interface PurchaseLine {
  variantId: string;
  sku: string;
  description: string;
  quantity: number;
  unitCost: number;
  taxRatePct: number;
  serialsText: string;
}

export interface CreatePurchasePayload {
  vendorId?: string;
  vendorName?: string;
  invoiceNo: string;
  invoiceDate: string;
  notes?: string;
  items: {
    variantId: string;
    quantity: number;
    unitCost: number;
    taxRatePct: number;
    serials: string[];
  }[];
}

export interface PurchaseListItem {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  vendorId: string | null;
  vendorName: string | null;
  status: PurchaseStatus;
  grandTotal: number;
  itemCount: number;
  receivedAt: string;
}

export interface PurchaseListResponse {
  items: PurchaseListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface PurchaseItemDetail {
  id: string;
  variantId: string;
  sku: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  taxRatePct: number;
  lineTotal: number;
  serials: { serialNo: string; status: SerialStatus }[];
}

export interface PurchaseDetail {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  status: PurchaseStatus;
  vendor: { id: string; name: string; phone: string | null } | null;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  notes: string | null;
  receivedAt: string;
  createdBy: { id: string; fullName: string } | null;
  items: PurchaseItemDetail[];
}

export interface SerialLookup {
  id: string;
  serialNo: string;
  status: SerialStatus;
  variant: {
    id: string;
    sku: string;
    productName: string;
    brandName: string | null;
    warrantyMonths: number | null;
  };
  purchase: {
    id: string;
    invoiceNo: string;
    invoiceDate: string;
    receivedAt: string;
    vendorName: string | null;
  } | null;
  sale: {
    id: string;
    invoiceNo: string;
    soldAt: string;
    customerName: string | null;
    customerPhone: string | null;
  } | null;
}
