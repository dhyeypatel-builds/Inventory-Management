import { prisma } from '../../db/prisma';
import { NotFoundError } from '../../utils/errors';

export const listProductTypes = async (includeInactive = false) => {
  return prisma.productType.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
  });
};

export const getProductType = async (id: number) => {
  const type = await prisma.productType.findUnique({ where: { id } });
  if (!type) throw new NotFoundError('Product type');
  return type;
};

export const getProductTypeAttributes = async (id: number) => {
  await getProductType(id);

  return prisma.attribute.findMany({
    where: { productTypeId: id },
    orderBy: { displayOrder: 'asc' },
    include: {
      options: {
        orderBy: { displayOrder: 'asc' },
        select: { id: true, value: true, displayOrder: true },
      },
    },
  });
};
