import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { slugify } from './categories.schema';

const childrenWhere = { deletedAt: null };

export const listCategories = async (query: { includeInactive?: boolean }) => {
  const where = {
    deletedAt: null,
    ...(query.includeInactive ? {} : { isActive: true }),
  };

  return prisma.category.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: {
        where: childrenWhere,
        select: { id: true, name: true, slug: true, isActive: true },
        orderBy: { name: 'asc' },
      },
    },
  });
};

export const getCategory = async (id: number) => {
  const category = await prisma.category.findFirst({
    where: { id, deletedAt: null },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: {
        where: childrenWhere,
        orderBy: { name: 'asc' },
      },
    },
  });
  if (!category) throw new NotFoundError('Category');
  return category;
};

export const createCategory = async (data: {
  name: string;
  slug?: string;
  parentId?: number;
}) => {
  const slug = data.slug ?? slugify(data.name);

  const existing = await prisma.category.findFirst({ where: { slug } });
  if (existing) throw new ConflictError(`Slug "${slug}" is already in use`);

  if (data.parentId !== undefined) {
    const parent = await prisma.category.findFirst({
      where: { id: data.parentId, deletedAt: null },
    });
    if (!parent) throw new NotFoundError('Parent category');
  }

  return prisma.category.create({
    data: { name: data.name, slug, parentId: data.parentId },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: { where: childrenWhere },
    },
  });
};

export const updateCategory = async (
  id: number,
  data: { name?: string; slug?: string; parentId?: number | null; isActive?: boolean },
) => {
  const existing = await getCategory(id);

  if (data.slug && data.slug !== existing.slug) {
    const slugExists = await prisma.category.findFirst({ where: { slug: data.slug } });
    if (slugExists) throw new ConflictError(`Slug "${data.slug}" is already in use`);
  }

  if (data.parentId !== undefined && data.parentId !== null) {
    if (data.parentId === id) throw new ConflictError('Category cannot be its own parent');
    const parent = await prisma.category.findFirst({
      where: { id: data.parentId, deletedAt: null },
    });
    if (!parent) throw new NotFoundError('Parent category');
  }

  return prisma.category.update({
    where: { id },
    data,
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: { where: childrenWhere, orderBy: { name: 'asc' } },
    },
  });
};

export const deleteCategory = async (id: number) => {
  await getCategory(id);
  await prisma.category.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
};
