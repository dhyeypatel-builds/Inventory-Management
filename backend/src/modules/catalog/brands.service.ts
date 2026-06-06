import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { parsePagination, buildMeta } from '../../utils/pagination';

export const listBrands = async (query: {
  q?: string;
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
}) => {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where = {
    ...(query.includeInactive ? {} : { isActive: true }),
    deletedAt: null,
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
  };

  const [brands, total] = await Promise.all([
    prisma.brand.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.brand.count({ where }),
  ]);

  return { brands, meta: buildMeta(page, pageSize, total) };
};

export const getBrand = async (id: number) => {
  const brand = await prisma.brand.findFirst({ where: { id, deletedAt: null } });
  if (!brand) throw new NotFoundError('Brand');
  return brand;
};

export const createBrand = async (data: { name: string; logoUrl?: string }) => {
  const existing = await prisma.brand.findFirst({ where: { name: data.name } });
  if (existing) throw new ConflictError(`Brand "${data.name}" already exists`);

  return prisma.brand.create({ data });
};

export const updateBrand = async (
  id: number,
  data: { name?: string; logoUrl?: string | null; isActive?: boolean },
) => {
  await getBrand(id);

  if (data.name) {
    const existing = await prisma.brand.findFirst({
      where: { name: data.name, NOT: { id } },
    });
    if (existing) throw new ConflictError(`Brand "${data.name}" already exists`);
  }

  return prisma.brand.update({ where: { id }, data });
};

export const deleteBrand = async (id: number) => {
  await getBrand(id);
  await prisma.brand.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
};
