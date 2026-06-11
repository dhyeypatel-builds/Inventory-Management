export interface DashboardSummary {
  today: { salesCount: number; revenue: number };
  mtd: { salesCount: number; revenue: number };
  totalSkus: number;
  stockValue: number;
  openAlerts: number;
}

export interface SalesTrendPoint {
  date: string;
  salesCount: number;
  revenue: number;
}

export type RevenueInterval = 'week' | 'month';

export interface RevenuePoint {
  /** Bucket start date (YYYY-MM-DD). */
  period: string;
  salesCount: number;
  revenue: number;
}

export interface TopBrand {
  brandId: number | null;
  brandName: string;
  units: number;
  revenue: number;
}

export interface FastMovingItem {
  variantId: string;
  sku: string;
  productName: string;
  brandName: string;
  units: number;
  revenue: number;
}
