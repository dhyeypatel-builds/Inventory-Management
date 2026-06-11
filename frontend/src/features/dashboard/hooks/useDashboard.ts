import { useQuery } from '@tanstack/react-query';
import {
  getSummary,
  getSalesTrend,
  getTopBrands,
  getFastMoving,
  getRevenueSeries,
} from '../api/dashboard.api';
import { getLowStockItems } from '../api/inventory.api';
import type { RevenueInterval } from '../types';

export function useRevenueSeries(interval: RevenueInterval, periods = 12) {
  return useQuery({
    queryKey: ['dashboard', 'revenue-series', interval, periods],
    queryFn: () => getRevenueSeries(interval, periods),
    staleTime: 60_000,
  });
}

export function useSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: getSummary,
    staleTime: 60_000,
  });
}

export function useSalesTrend(range = 30) {
  return useQuery({
    queryKey: ['dashboard', 'sales-trend', range],
    queryFn: () => getSalesTrend(range),
    staleTime: 60_000,
  });
}

export function useTopBrands(limit = 5) {
  return useQuery({
    queryKey: ['dashboard', 'top-brands', limit],
    queryFn: () => getTopBrands(limit),
    staleTime: 60_000,
  });
}

export function useFastMoving(limit = 5) {
  return useQuery({
    queryKey: ['dashboard', 'fast-moving', limit],
    queryFn: () => getFastMoving(limit),
    staleTime: 60_000,
  });
}

export function useLowStockItems(pageSize = 8) {
  return useQuery({
    queryKey: ['dashboard', 'low-stock', pageSize],
    queryFn: () => getLowStockItems(pageSize),
    staleTime: 60_000,
  });
}
