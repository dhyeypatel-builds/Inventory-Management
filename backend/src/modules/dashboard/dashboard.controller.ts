import type { Request, Response, NextFunction } from 'express';
import * as dashboardService from './dashboard.service';
import { success } from '../../utils/apiResponse';

// Clamp a query param into an integer within [min, max], falling back to def.
const toInt = (value: unknown, def: number, min: number, max: number): number => {
  const n = parseInt(String(value ?? ''), 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
};

export const summary = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    success(res, await dashboardService.getSummary());
  } catch (err) {
    next(err);
  }
};

export const salesTrend = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const days = toInt(req.query.range, 30, 1, 365);
    const series = await dashboardService.getSalesTrend(days);
    success(res, { range: days, series });
  } catch (err) {
    next(err);
  }
};

export const topBrands = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const limit = toInt(req.query.limit, 5, 1, 50);
    success(res, await dashboardService.getTopBrands(limit));
  } catch (err) {
    next(err);
  }
};

export const fastMoving = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const limit = toInt(req.query.limit, 10, 1, 50);
    success(res, await dashboardService.getFastMoving(limit));
  } catch (err) {
    next(err);
  }
};
