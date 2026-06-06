import { api } from '@/shared/api/client';
import type { DashboardSummary, SalesTrendPoint, TopBrand, FastMovingItem } from '../types';

export async function getSummary(): Promise<DashboardSummary> {
  const res = await api.get('/dashboard/summary');
  return res.data.data as DashboardSummary;
}

export async function getSalesTrend(range = 30): Promise<SalesTrendPoint[]> {
  const res = await api.get('/dashboard/sales-trend', { params: { range } });
  return res.data.data as SalesTrendPoint[];
}

export async function getTopBrands(limit = 5): Promise<TopBrand[]> {
  const res = await api.get('/dashboard/top-brands', { params: { limit } });
  return res.data.data as TopBrand[];
}

export async function getFastMoving(limit = 5): Promise<FastMovingItem[]> {
  const res = await api.get('/dashboard/fast-moving', { params: { limit } });
  return res.data.data as FastMovingItem[];
}
