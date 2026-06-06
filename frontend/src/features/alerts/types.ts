export type AlertType = 'LOW_STOCK' | 'OUT_OF_STOCK';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface AlertItem {
  id: string;
  variantId: string;
  sku: string | null;
  productName: string | null;
  brandName: string | null;
  type: AlertType;
  status: AlertStatus;
  message: string;
  currentQty: number;
  threshold: number;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AlertListResponse {
  items: AlertItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ListAlertsParams {
  status?: AlertStatus;
  type?: AlertType;
  page?: number;
  pageSize?: number;
}
