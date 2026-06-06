import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { NotFoundError } from '../../utils/errors';
import { parsePagination, buildMeta } from '../../utils/pagination';
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersQuery,
} from './customers.schema';

// ─── List (search by name/phone) ────────────────────────────────────────────

export const listCustomers = async (query: ListCustomersQuery) => {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.CustomerWhereInput = {
    deletedAt: null,
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' as const } },
            { phone: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.customer.count({ where }),
  ]);

  return { customers, meta: buildMeta(page, pageSize, total) };
};

// ─── Detail with recent purchase history ────────────────────────────────────

export const getCustomer = async (id: string) => {
  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      sales: {
        orderBy: { soldAt: 'desc' },
        take: 20,
        select: {
          id: true,
          invoiceNo: true,
          status: true,
          grandTotal: true,
          paymentMode: true,
          soldAt: true,
        },
      },
    },
  });
  if (!customer) throw new NotFoundError('Customer');

  const { sales, ...rest } = customer;
  return {
    ...rest,
    recentSales: sales.map((s) => ({ ...s, grandTotal: Number(s.grandTotal) })),
  };
};

export const createCustomer = async (data: CreateCustomerInput) => {
  return prisma.customer.create({
    data: {
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      vatNumber: data.vatNumber ?? null,
      address: data.address ?? null,
      vehicleNo: data.vehicleNo ?? null,
      notes: data.notes ?? null,
    },
  });
};

export const updateCustomer = async (id: string, data: UpdateCustomerInput) => {
  const customer = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!customer) throw new NotFoundError('Customer');

  return prisma.customer.update({ where: { id }, data });
};

export const deleteCustomer = async (id: string) => {
  const customer = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!customer) throw new NotFoundError('Customer');

  await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
};
