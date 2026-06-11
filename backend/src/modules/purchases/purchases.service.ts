import { Prisma } from '@prisma/client';
import { prisma, type TxClient } from '../../db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { parsePagination, buildMeta } from '../../utils/pagination';
import { reevaluateVariants } from '../alerts/alerts.service';
import type {
  CreateVendorInput,
  UpdateVendorInput,
  ListVendorsQuery,
  CreatePurchaseInput,
  ListPurchasesQuery,
  UpdateSerialInput,
} from './purchases.schema';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// ─── Vendors ─────────────────────────────────────────────────────────────────

export const listVendors = async (query: ListVendorsQuery) => {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.VendorWhereInput = {
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

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.vendor.count({ where }),
  ]);

  return { vendors, meta: buildMeta(page, pageSize, total) };
};

export const createVendor = async (data: CreateVendorInput) => {
  return prisma.vendor.create({
    data: {
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      vatNumber: data.vatNumber ?? null,
      address: data.address ?? null,
      notes: data.notes ?? null,
    },
  });
};

export const updateVendor = async (id: string, data: UpdateVendorInput) => {
  const vendor = await prisma.vendor.findFirst({ where: { id, deletedAt: null } });
  if (!vendor) throw new NotFoundError('Vendor');

  return prisma.vendor.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.vatNumber !== undefined ? { vatNumber: data.vatNumber } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
  });
};

/** Finds an existing vendor by (case-insensitive) name or creates one. */
async function resolveVendor(tx: TxClient, data: CreatePurchaseInput): Promise<string> {
  if (data.vendorId) {
    const vendor = await tx.vendor.findFirst({
      where: { id: data.vendorId, deletedAt: null },
    });
    if (!vendor) throw new NotFoundError('Vendor');
    return vendor.id;
  }

  const existing = await tx.vendor.findFirst({
    where: { deletedAt: null, name: { equals: data.vendorName!, mode: 'insensitive' } },
  });
  if (existing) return existing.id;

  const created = await tx.vendor.create({ data: { name: data.vendorName! } });
  return created.id;
}

// ─── Create purchase (stock-in, atomic) ──────────────────────────────────────

export const createPurchase = async (data: CreatePurchaseInput, createdBy?: string) => {
  // Load variants and validate existence up front.
  const variantIds = [...new Set(data.items.map((i) => i.variantId))];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, deletedAt: null },
    include: { product: { select: { name: true } } },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));
  for (const id of variantIds) {
    if (!variantMap.has(id)) {
      throw new ValidationError(`Variant ${id} not found`, { variantId: id });
    }
  }

  // Reject duplicate serials within the request itself.
  const allSerials = data.items.flatMap((i) => i.serials);
  const seen = new Set<string>();
  for (const s of allSerials) {
    if (seen.has(s)) throw new ValidationError(`Duplicate serial number in request: ${s}`);
    seen.add(s);
  }

  // Line totals (no per-line discount on purchases — invoice is entered as billed).
  const lines = data.items.map((item) => {
    const variant = variantMap.get(item.variantId)!;
    const lineBase = round2(item.unitCost * item.quantity);
    const lineTax = round2((lineBase * item.taxRatePct) / 100);
    return {
      ...item,
      description: `${variant.product.name} (${variant.sku})`,
      lineBase,
      lineTax,
      lineTotal: round2(lineBase + lineTax),
    };
  });

  const subtotal = round2(lines.reduce((acc, l) => acc + l.lineBase, 0));
  const taxTotal = round2(lines.reduce((acc, l) => acc + l.lineTax, 0));
  const grandTotal = round2(subtotal + taxTotal);

  let purchaseId: string;
  try {
    purchaseId = await prisma.$transaction(async (tx) => {
      const vendorId = await resolveVendor(tx, data);

      const purchase = await tx.purchase.create({
        data: {
          vendorId,
          invoiceNo: data.invoiceNo,
          invoiceDate: new Date(`${data.invoiceDate}T00:00:00.000Z`),
          status: 'RECEIVED',
          subtotal,
          taxTotal,
          grandTotal,
          notes: data.notes ?? null,
          createdBy: createdBy ?? null,
        },
      });

      for (const line of lines) {
        // Items created one-by-one (not createMany): each row's id anchors its
        // serial numbers, and the tenancy extension stamps tenant_id per create.
        const item = await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            variantId: line.variantId,
            description: line.description,
            quantity: line.quantity,
            unitCost: line.unitCost,
            taxRatePct: line.taxRatePct,
            lineTotal: line.lineTotal,
          },
        });

        for (const serialNo of line.serials) {
          await tx.serialNumber.create({
            data: {
              variantId: line.variantId,
              serialNo,
              status: 'IN_STOCK',
              purchaseItemId: item.id,
            },
          });
        }

        // Stock-in: increment on hand + ledger entry.
        const inv = await tx.inventory.upsert({
          where: { variantId: line.variantId },
          update: { quantity: { increment: line.quantity } },
          create: { variantId: line.variantId, quantity: line.quantity },
        });

        await tx.stockMovement.create({
          data: {
            variantId: line.variantId,
            type: 'PURCHASE',
            quantityDelta: line.quantity,
            balanceAfter: inv.quantity,
            referenceType: 'purchase',
            referenceId: purchase.id,
            note: `Purchase ${data.invoiceNo}`,
            createdBy: createdBy ?? null,
          },
        });
      }

      return purchase.id;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('One of the serial numbers already exists in the system');
    }
    throw err;
  }

  // Restock may clear low-stock / out-of-stock alerts.
  await reevaluateVariants(variantIds);

  return getPurchase(purchaseId);
};

// ─── Read ────────────────────────────────────────────────────────────────────

export const listPurchases = async (query: ListPurchasesQuery) => {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.PurchaseWhereInput = {
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.q
      ? {
          OR: [
            { invoiceNo: { contains: query.q, mode: 'insensitive' as const } },
            { vendor: { name: { contains: query.q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
    ...(query.from || query.to
      ? {
          receivedAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  };

  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      skip,
      take,
      orderBy: { receivedAt: 'desc' },
      include: {
        vendor: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.purchase.count({ where }),
  ]);

  return {
    items: purchases.map((p) => ({
      id: p.id,
      invoiceNo: p.invoiceNo,
      invoiceDate: p.invoiceDate,
      vendorId: p.vendorId,
      vendorName: p.vendor?.name ?? null,
      status: p.status,
      grandTotal: Number(p.grandTotal),
      itemCount: p._count.items,
      receivedAt: p.receivedAt,
    })),
    meta: buildMeta(page, pageSize, total),
  };
};

export const getPurchase = async (id: string) => {
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      vendor: { select: { id: true, name: true, phone: true } },
      items: {
        include: {
          variant: { select: { sku: true } },
          serials: { select: { serialNo: true, status: true } },
        },
      },
      createdByUser: { select: { id: true, fullName: true } },
    },
  });
  if (!purchase) throw new NotFoundError('Purchase');

  return {
    id: purchase.id,
    invoiceNo: purchase.invoiceNo,
    invoiceDate: purchase.invoiceDate,
    status: purchase.status,
    vendor: purchase.vendor,
    subtotal: Number(purchase.subtotal),
    taxTotal: Number(purchase.taxTotal),
    grandTotal: Number(purchase.grandTotal),
    notes: purchase.notes,
    receivedAt: purchase.receivedAt,
    createdBy: purchase.createdByUser
      ? { id: purchase.createdByUser.id, fullName: purchase.createdByUser.fullName }
      : null,
    items: purchase.items.map((it) => ({
      id: it.id,
      variantId: it.variantId,
      sku: it.variant?.sku ?? null,
      description: it.description,
      quantity: it.quantity,
      unitCost: Number(it.unitCost),
      taxRatePct: Number(it.taxRatePct),
      lineTotal: Number(it.lineTotal),
      serials: it.serials.map((s) => ({ serialNo: s.serialNo, status: s.status })),
    })),
  };
};

// ─── Serial lookup (warranty / DOA tracing) ──────────────────────────────────

export const getSerial = async (serialNo: string) => {
  const serial = await prisma.serialNumber.findFirst({
    where: { serialNo },
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          product: {
            select: { id: true, name: true, warrantyMonths: true, brand: { select: { name: true } } },
          },
        },
      },
      purchaseItem: {
        select: {
          purchase: {
            select: {
              id: true,
              invoiceNo: true,
              invoiceDate: true,
              receivedAt: true,
              vendor: { select: { id: true, name: true } },
            },
          },
        },
      },
      saleItem: {
        select: {
          sale: {
            select: {
              id: true,
              invoiceNo: true,
              soldAt: true,
              customer: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      },
    },
  });
  if (!serial) throw new NotFoundError('Serial number');

  return {
    id: serial.id,
    serialNo: serial.serialNo,
    status: serial.status,
    variant: {
      id: serial.variant.id,
      sku: serial.variant.sku,
      productName: serial.variant.product.name,
      brandName: serial.variant.product.brand?.name ?? null,
      warrantyMonths: serial.variant.product.warrantyMonths,
    },
    purchase: serial.purchaseItem?.purchase
      ? {
          id: serial.purchaseItem.purchase.id,
          invoiceNo: serial.purchaseItem.purchase.invoiceNo,
          invoiceDate: serial.purchaseItem.purchase.invoiceDate,
          receivedAt: serial.purchaseItem.purchase.receivedAt,
          vendorName: serial.purchaseItem.purchase.vendor?.name ?? null,
        }
      : null,
    sale: serial.saleItem?.sale
      ? {
          id: serial.saleItem.sale.id,
          invoiceNo: serial.saleItem.sale.invoiceNo,
          soldAt: serial.saleItem.sale.soldAt,
          customerName: serial.saleItem.sale.customer?.name ?? null,
          customerPhone: serial.saleItem.sale.customer?.phone ?? null,
        }
      : null,
  };
};

export const updateSerialStatus = async (serialNo: string, data: UpdateSerialInput) => {
  const serial = await prisma.serialNumber.findFirst({ where: { serialNo } });
  if (!serial) throw new NotFoundError('Serial number');

  await prisma.serialNumber.update({
    where: { id: serial.id },
    data: { status: data.status },
  });

  return getSerial(serialNo);
};
