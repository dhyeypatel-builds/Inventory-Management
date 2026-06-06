import type { Response } from 'express';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const success = <T>(res: Response, data: T, statusCode = 200): Response =>
  res.status(statusCode).json({ success: true, data });

export const created = <T>(res: Response, data: T): Response =>
  success(res, data, 201);

export const noContent = (res: Response): Response =>
  res.status(204).send();

export const paginated = <T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
): Response =>
  res.status(200).json({ success: true, data, meta });
