import { Prisma } from '@prisma/client';
import { prisma, type TxClient } from '../../db/prisma';
import {
  ConflictError,
  ForbiddenError,
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors';
import { parsePagination, buildMeta } from '../../utils/pagination';
import { reevaluateVariants } from '../alerts/alerts.service';
import type { CreateSaleInput, ListSalesQuery, ReturnSaleInput } from './sales.schema';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// Concurrent sales contend on sequential invoice numbering and serializable
// row locks; such conflicts are transient, so retry the transaction a few
// times with jittered backoff before surfacing a 409 to the caller.
const MAX_SALE_TX_ATTEMPTS = 6;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Invoice numbering (INV-YYYY-NNNNNN, sequential per year) ─────────────────

async function nextInvoiceNo(tx: TxClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const last = await tx.sale.findFirst({
    where: { invoiceNo: { startsWith: prefix } },
    orderBy: { invoiceNo: 'desc' },
    select: { invoiceNo: true },
  });

  const seq = last ? parseInt(last.invoiceNo.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(6, '0')}`;
}

// ─── Create sale (atomic, serializable) ──────────────────────────────────────

export const createSale = async (
  data: CreateSaleInput,
  createdBy?: string,
  idempotencyKey?: string,
  actorPermissions: string[] = [],
) => {
  // Short-circuit: an already-processed idempotency key returns the same sale.
  if (idempotencyKey) {
    const existing = await prisma.sale.findFirst({ where: { idempotencyKey } });
    if (existing) return getSale(existing.id);
  }

  // Validate customer (if any) up front.
  if (data.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, deletedAt: null },
    });
    if (!customer) throw new NotFoundError('Customer');
  }

  // Aggregate requested quantity per variant (a variant may appear in >1 line).
  const qtyByVariant = new Map<string, number>();
  for (const item of data.items) {
    qtyByVariant.set(item.variantId, (qtyByVariant.get(item.variantId) ?? 0) + item.quantity);
  }

  // Load variants (with on-hand) and validate existence/active state.
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: [...qtyByVariant.keys()] }, deletedAt: null, isActive: true },
    include: {
      product: { select: { name: true } },
      inventory: { select: { quantity: true } },
    },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  for (const variantId of qtyByVariant.keys()) {
    if (!variantMap.has(variantId)) {
      throw new ValidationError(`Variant ${variantId} not found or inactive`, { variantId });
    }
  }

  // Build line items with price/description snapshots and per-line totals.
  const canOverridePrice = actorPermissions.includes('sale:override_price');
  const lines = data.items.map((item) => {
    const variant = variantMap.get(item.variantId)!;
    const unitPrice = item.unitPrice ?? Number(variant.sellingPrice);

    // Selling at a price other than the listed one is a fraud vector at the
    // till — it needs its own permission (ADMIN-only by default).
    if (unitPrice !== Number(variant.sellingPrice) && !canOverridePrice) {
      throw new ForbiddenError('Changing the unit price requires price-override permission');
    }
    const taxRatePct = Number(variant.taxRatePct);
    const lineBase = round2(unitPrice * item.quantity);

    if (item.discount > lineBase) {
      throw new ValidationError(
        `Line discount (${item.discount}) exceeds line amount (${lineBase})`,
        { variantId: item.variantId },
      );
    }

    const taxable = round2(lineBase - item.discount);
    const lineTax = round2((taxable * taxRatePct) / 100);
    const lineTotal = round2(taxable + lineTax);

    return {
      variantId: item.variantId,
      description: `${variant.product.name} (${variant.sku})`,
      quantity: item.quantity,
      unitPrice,
      discount: item.discount,
      taxRatePct,
      lineTax,
      lineTotal,
      lineBase,
      serials: item.serials ?? [],
    };
  });

  // Pre-flight stock check (the transaction re-checks authoritatively).
  const insufficient = [...qtyByVariant.entries()]
    .map(([variantId, requested]) => {
      const available = variantMap.get(variantId)!.inventory?.quantity ?? 0;
      return { variantId, available, requested };
    })
    .filter((s) => s.available < s.requested);
  if (insufficient.length > 0) throw new InsufficientStockError(insufficient);

  const subtotal = round2(lines.reduce((acc, l) => acc + l.lineBase, 0));
  const discount = round2(lines.reduce((acc, l) => acc + l.discount, 0));
  const taxTotal = round2(lines.reduce((acc, l) => acc + l.lineTax, 0));
  const grandTotal = round2(subtotal - discount + taxTotal);

  for (let attempt = 0; attempt < MAX_SALE_TX_ATTEMPTS; attempt++) {
    try {
      const saleId = await prisma.$transaction(
        async (tx) => {
          const invoiceNo = await nextInvoiceNo(tx);

          const sale = await tx.sale.create({
            data: {
              invoiceNo,
              customerId: data.customerId ?? null,
              status: 'CONFIRMED',
              subtotal,
              discount,
              taxTotal,
              grandTotal,
              paymentMode: data.paymentMode,
              createdBy: createdBy ?? null,
              idempotencyKey: idempotencyKey ?? null,
            },
          });

          // Sale items are created separately (not nested) so the tenancy
          // extension stamps each row's tenant_id; nested creates bypass it.
          // One-by-one (not createMany) because serial numbers anchor to item ids.
          for (const l of lines) {
            const item = await tx.saleItem.create({
              data: {
                saleId: sale.id,
                variantId: l.variantId,
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                discount: l.discount,
                taxRatePct: l.taxRatePct,
                lineTotal: l.lineTotal,
              },
            });

            // Claim the sold units' serial numbers (must be IN_STOCK for this variant).
            if (l.serials.length > 0) {
              const claimed = await tx.serialNumber.updateMany({
                where: {
                  serialNo: { in: l.serials },
                  variantId: l.variantId,
                  status: 'IN_STOCK',
                },
                data: { status: 'SOLD', saleItemId: item.id },
              });
              if (claimed.count !== l.serials.length) {
                throw new ValidationError(
                  `One or more serial numbers are unknown or not in stock for ${l.description}`,
                  { variantId: l.variantId, serials: l.serials },
                );
              }
            }
          }

          // Authoritative stock check + decrement inside the serializable txn.
          for (const [variantId, requested] of qtyByVariant) {
            const inv = await tx.inventory.findUnique({ where: { variantId } });
            const available = inv?.quantity ?? 0;
            if (available < requested) {
              throw new InsufficientStockError([{ variantId, available, requested }]);
            }
            const balanceAfter = available - requested;

            await tx.inventory.update({
              where: { variantId },
              data: { quantity: balanceAfter },
            });

            await tx.stockMovement.create({
              data: {
                variantId,
                type: 'SALE',
                quantityDelta: -requested,
                balanceAfter,
                referenceType: 'sale',
                referenceId: sale.id,
                note: `Sale ${invoiceNo}`,
                createdBy: createdBy ?? null,
              },
            });
          }

          return sale.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      // Sold-down stock may now be at/below reorder level — raise alerts.
      await reevaluateVariants(qtyByVariant.keys());

      return getSale(saleId);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // Idempotency-key race: a concurrent request created the sale first.
        if (err.code === 'P2002' && idempotencyKey) {
          const existing = await prisma.sale.findFirst({ where: { idempotencyKey } });
          if (existing) return getSale(existing.id);
        }
        // Transient conflicts: a serialization failure (P2034) or an
        // invoice-number collision (P2002) under concurrency. Both are safe to
        // retry — the transaction recomputes the invoice number and re-checks
        // stock from scratch.
        if (err.code === 'P2034' || err.code === 'P2002') {
          await sleep(20 * (attempt + 1) + Math.floor(Math.random() * 20));
          continue;
        }
      }
      throw err;
    }
  }

  // Retries exhausted while still hitting transient write conflicts.
  throw new ConflictError('Transaction conflict, please retry', { retryable: true });
};

// ─── Detail ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatSale(sale: any) {
  return {
    id: sale.id,
    invoiceNo: sale.invoiceNo,
    customerId: sale.customerId,
    customer: sale.customer
      ? { id: sale.customer.id, name: sale.customer.name, phone: sale.customer.phone }
      : null,
    status: sale.status,
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    taxTotal: Number(sale.taxTotal),
    grandTotal: Number(sale.grandTotal),
    paymentMode: sale.paymentMode,
    soldAt: sale.soldAt,
    createdBy: sale.createdBy,
    items: sale.items.map((it: any) => ({
      id: it.id,
      variantId: it.variantId,
      sku: it.variant?.sku ?? null,
      description: it.description,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice),
      discount: Number(it.discount),
      taxRatePct: Number(it.taxRatePct),
      lineTotal: Number(it.lineTotal),
    })),
  };
}

const saleDetailInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  items: { include: { variant: { select: { sku: true } } } },
} as const;

export const getSale = async (id: string) => {
  const sale = await prisma.sale.findUnique({ where: { id }, include: saleDetailInclude });
  if (!sale) throw new NotFoundError('Sale');
  return formatSale(sale);
};

// ─── List ────────────────────────────────────────────────────────────────────

export const listSales = async (query: ListSalesQuery) => {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.SaleWhereInput = {
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.from || query.to
      ? {
          soldAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  };

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      skip,
      take,
      orderBy: { soldAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.sale.count({ where }),
  ]);

  const items = sales.map((s) => ({
    id: s.id,
    invoiceNo: s.invoiceNo,
    customerId: s.customerId,
    customerName: s.customer?.name ?? null,
    status: s.status,
    grandTotal: Number(s.grandTotal),
    paymentMode: s.paymentMode,
    soldAt: s.soldAt,
    itemCount: s._count.items,
  }));

  return { items, meta: buildMeta(page, pageSize, total) };
};

// ─── Cancel (restock all items via SALE_RETURN movements) ────────────────────

export const cancelSale = async (id: string, actorId?: string) => {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!sale) throw new NotFoundError('Sale');
  if (sale.status !== 'CONFIRMED') {
    throw new ConflictError(
      `Sale ${sale.invoiceNo} is already ${sale.status.toLowerCase()} and cannot be cancelled`,
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const item of sale.items) {
      const inv = await tx.inventory.findUnique({ where: { variantId: item.variantId } });
      const current = inv?.quantity ?? 0;
      const balanceAfter = current + item.quantity;

      await tx.inventory.update({
        where: { variantId: item.variantId },
        data: { quantity: balanceAfter },
      });

      await tx.stockMovement.create({
        data: {
          variantId: item.variantId,
          type: 'SALE_RETURN',
          quantityDelta: item.quantity,
          balanceAfter,
          referenceType: 'sale',
          referenceId: sale.id,
          note: `Cancelled: ${sale.invoiceNo}`,
          createdBy: actorId ?? null,
        },
      });
    }

    // Units come back into stock — release their serial numbers.
    await tx.serialNumber.updateMany({
      where: { saleItemId: { in: sale.items.map((i) => i.id) }, status: 'SOLD' },
      data: { status: 'IN_STOCK', saleItemId: null },
    });

    await tx.sale.update({ where: { id }, data: { status: 'CANCELLED' } });
  });

  // Restocking may resolve open low/out-of-stock alerts.
  await reevaluateVariants(sale.items.map((i) => i.variantId));

  return getSale(id);
};

// ─── Return (partial or full, restock via SALE_RETURN movements) ─────────────

export const returnSale = async (id: string, data: ReturnSaleInput, actorId?: string) => {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!sale) throw new NotFoundError('Sale');
  if (sale.status !== 'CONFIRMED') {
    throw new ConflictError(
      `Sale ${sale.invoiceNo} is already ${sale.status.toLowerCase()} and cannot be returned`,
    );
  }

  // Default to returning all items when no items list is provided.
  const toReturn: { variantId: string; quantity: number }[] =
    data.items && data.items.length > 0
      ? data.items
      : sale.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));

  // Validate: return qty must not exceed sold qty for each variant.
  const soldByVariant = new Map(sale.items.map((i) => [i.variantId, i.quantity]));
  for (const ret of toReturn) {
    const sold = soldByVariant.get(ret.variantId);
    if (sold === undefined) {
      throw new ValidationError(
        `Variant ${ret.variantId} is not part of sale ${sale.invoiceNo}`,
        { variantId: ret.variantId },
      );
    }
    if (ret.quantity > sold) {
      throw new ValidationError(
        `Return quantity (${ret.quantity}) exceeds sold quantity (${sold}) for variant ${ret.variantId}`,
        { variantId: ret.variantId, sold, requested: ret.quantity },
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const ret of toReturn) {
      const inv = await tx.inventory.findUnique({ where: { variantId: ret.variantId } });
      const current = inv?.quantity ?? 0;
      const balanceAfter = current + ret.quantity;

      await tx.inventory.update({
        where: { variantId: ret.variantId },
        data: { quantity: balanceAfter },
      });

      await tx.stockMovement.create({
        data: {
          variantId: ret.variantId,
          type: 'SALE_RETURN',
          quantityDelta: ret.quantity,
          balanceAfter,
          referenceType: 'sale',
          referenceId: sale.id,
          note: `Return: ${sale.invoiceNo}`,
          createdBy: actorId ?? null,
        },
      });
    }

    // Mark returned units' serials. On a partial return the specific units
    // are unknown — staff flag individual serials via PATCH /serials/:serialNo.
    const isFullReturn = !data.items || data.items.length === 0;
    if (isFullReturn) {
      await tx.serialNumber.updateMany({
        where: { saleItemId: { in: sale.items.map((i) => i.id) }, status: 'SOLD' },
        data: { status: 'RETURNED' },
      });
    }

    await tx.sale.update({ where: { id }, data: { status: 'RETURNED' } });
  });

  // Restocking may resolve open low/out-of-stock alerts.
  await reevaluateVariants(toReturn.map((r) => r.variantId));

  return getSale(id);
};

// ─── Invoice (printable payload) ─────────────────────────────────────────────

export const getSaleInvoice = async (id: string) => {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { variant: { select: { sku: true } } } },
      createdByUser: { select: { id: true, fullName: true } },
    },
  });
  if (!sale) throw new NotFoundError('Sale');

  // Pull company settings for header.
  const settingRows = await prisma.setting.findMany({
    where: { key: { startsWith: 'company.' } },
  });
  const company: Record<string, unknown> = {};
  for (const s of settingRows) {
    company[s.key.replace('company.', '')] = s.value;
  }

  return {
    invoiceNo: sale.invoiceNo,
    status: sale.status,
    soldAt: sale.soldAt,
    paymentMode: sale.paymentMode,
    company,
    customer: sale.customer
      ? {
          name: sale.customer.name,
          phone: sale.customer.phone,
          email: sale.customer.email,
          vatNumber: sale.customer.vatNumber,
          address: sale.customer.address,
          vehicleNo: sale.customer.vehicleNo,
        }
      : null,
    items: sale.items.map((it) => ({
      description: it.description,
      sku: it.variant?.sku ?? null,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice),
      discount: Number(it.discount),
      taxRatePct: Number(it.taxRatePct),
      lineTotal: Number(it.lineTotal),
    })),
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    taxTotal: Number(sale.taxTotal),
    grandTotal: Number(sale.grandTotal),
    createdBy: sale.createdByUser
      ? { id: sale.createdByUser.id, fullName: sale.createdByUser.fullName }
      : null,
  };
};
