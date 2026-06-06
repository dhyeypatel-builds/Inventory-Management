import type { PaginationMeta } from './apiResponse';

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export const parsePagination = (query: {
  page?: string | number;
  pageSize?: string | number;
}): PaginationParams => {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(String(query.pageSize ?? '20'), 10) || 20),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
};

export const buildMeta = (
  page: number,
  pageSize: number,
  total: number,
): PaginationMeta => ({
  page,
  pageSize,
  total,
  totalPages: Math.ceil(total / pageSize),
});
