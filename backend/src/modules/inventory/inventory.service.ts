import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { currentTenant } from '../../tenancy/context';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { parsePagination, buildMeta } from '../../utils/pagination';
import { reevaluateVariants } from '../alerts/alerts.service';
import type {
  ListInventoryQuery,
  UpdateInventoryInput,
  AdjustStockInput,
  MovementsQuery,
} from './inventory.schema';

// ─── EAV resolver (minimal, for displaying attributes like size) ──────────────

function resolveAttrs(
  rows: Array<{
    attribute: { code: string; datatype: string };
    valueText: string | null;
    valueNumber: Prisma.Decimal | null;
    valueBool: boolean | null;
    valueDate: Date | null;
  }>,
): Record<string, unknown> {
  return Object.fromEntries(
    rows.map(({ attribute: { code, datatype }, valueText, valueNumber, valueBool, valueDate }) => {
      switch (datatype) {
        case 'TEXT':
        case 'ENUM':
          return [code, valueText];
        case 'NUMBER':
          return [code, valueNumber !== null ? Number(valueNumber) : null];
        case 'BOOLEAN':
          return [code, valueBool];
        case 'DATE':
          return [code, valueDate ? valueDate.toISOString() : null];
        default:
          return [code, null];
      }
    }),
  );
}

const inventoryInclude = {
  variant: {
    include: {
      product: { include: { brand: { select: { id: true, name: true } } } },
      attributeValues: {
        include: { attribute: { select: { code: true, datatype: true } } },
      },
    },
  },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatInventory(inv: any) {
  const { variant, quantity, reorderLevel, rackLocation, updatedAt } = inv;
  return {
    variantId: inv.variantId,
    sku: variant.sku,
    productId: variant.productId,
    productName: variant.product.name,
    brandName: variant.product.brand?.name ?? null,
    onHand: quantity,
    reorderLevel,
    rackLocation,
    lowStock: quantity <= reorderLevel,
    sellingPrice: Number(variant.sellingPrice),
    purchasePrice: Number(variant.purchasePrice),
    attributeValues: resolveAttrs(variant.attributeValues),
    updatedAt,
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export const listInventory = async (query: ListInventoryQuery) => {
  const { page, pageSize, skip, take } = parsePagination(query);

  // Prisma cannot compare two columns (quantity <= reorder_level) in a standard
  // where clause, so resolve the low-stock variant IDs with a raw query first.
  let lowStockIds: string[] | undefined;
  if (query.lowStock) {
    const tenantId = currentTenant();
    const rows = await prisma.$queryRaw<{ variant_id: string }[]>`
      SELECT variant_id FROM inventory
      WHERE tenant_id = ${tenantId} AND quantity <= reorder_level
    `;
    lowStockIds = rows.map((r) => r.variant_id);
    if (lowStockIds.length === 0) {
      return { items: [], meta: buildMeta(page, pageSize, 0) };
    }
  }

  const where: Prisma.InventoryWhereInput = {
    ...(lowStockIds ? { variantId: { in: lowStockIds } } : {}),
    ...(query.rack
      ? { rackLocation: { contains: query.rack, mode: 'insensitive' as const } }
      : {}),
    variant: {
      deletedAt: null,
      isActive: true,
      product: {
        deletedAt: null,
        isActive: true,
        ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
      },
    },
  };

  const [rows, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      skip,
      take,
      orderBy: { variant: { product: { name: 'asc' } } },
      include: inventoryInclude,
    }),
    prisma.inventory.count({ where }),
  ]);

  return { items: rows.map(formatInventory), meta: buildMeta(page, pageSize, total) };
};

// ─── Detail ─────────────────────────────────────────────────────────────────

export const getInventory = async (variantId: string) => {
  const inv = await prisma.inventory.findUnique({
    where: { variantId },
    include: inventoryInclude,
  });
  if (!inv || inv.variant.deletedAt !== null) throw new NotFoundError('Inventory');
  return formatInventory(inv);
};

// ─── Update reorder level / rack ──────────────────────────────────────────────

export const updateInventory = async (variantId: string, data: UpdateInventoryInput) => {
  const inv = await prisma.inventory.findUnique({
    where: { variantId },
    include: { variant: { select: { deletedAt: true } } },
  });
  if (!inv || inv.variant.deletedAt !== null) throw new NotFoundError('Inventory');

  await prisma.inventory.update({
    where: { variantId },
    data: {
      ...(data.reorderLevel !== undefined ? { reorderLevel: data.reorderLevel } : {}),
      ...(data.rackLocation !== undefined ? { rackLocation: data.rackLocation } : {}),
    },
  });

  return getInventory(variantId);
};

// ─── Adjust stock (D-02) ──────────────────────────────────────────────────────

export const adjustStock = async (
  variantId: string,
  data: AdjustStockInput,
  createdBy?: string,
) => {
  const inv = await prisma.inventory.findUnique({
    where: { variantId },
    include: { variant: { select: { deletedAt: true } } },
  });
  if (!inv || inv.variant.deletedAt !== null) throw new NotFoundError('Inventory');

  const newQty = inv.quantity + data.delta;
  if (newQty < 0) {
    throw new ConflictError(
      `Adjustment would result in negative stock (current ${inv.quantity}, delta ${data.delta})`,
      { variantId, available: inv.quantity, requested: data.delta },
    );
  }

  const note = data.note ? `${data.reason}: ${data.note}` : data.reason;

  await prisma.$transaction(async (tx) => {
    await tx.inventory.update({
      where: { variantId },
      data: { quantity: newQty },
    });

    await tx.stockMovement.create({
      data: {
        variantId,
        type: 'ADJUSTMENT',
        quantityDelta: data.delta,
        balanceAfter: newQty,
        note,
        createdBy: createdBy ?? null,
      },
    });
  });

  // Re-evaluate stock alerts now that on-hand has changed.
  await reevaluateVariants([variantId]);

  return getInventory(variantId);
};

// ─── Stock valuation (D-03) ───────────────────────────────────────────────────

export const getValuation = async () => {
  const tenantId = currentTenant();
  const [totalRow] = await prisma.$queryRaw<{ total_value: string }[]>`
    SELECT COALESCE(SUM(i.quantity * pv.purchase_price), 0)::text AS total_value
    FROM inventory i
    JOIN product_variants pv ON i.variant_id = pv.id
    JOIN products p          ON pv.product_id = p.id
    WHERE i.tenant_id = ${tenantId}
      AND pv.deleted_at IS NULL AND pv.is_active = true
      AND p.deleted_at  IS NULL AND p.is_active  = true
  `;

  const brandRows = await prisma.$queryRaw<{
    brand_id: number | null;
    brand_name: string | null;
    total_qty: string;
    total_value: string;
  }[]>`
    SELECT
      b.id   AS brand_id,
      b.name AS brand_name,
      SUM(i.quantity)::text                     AS total_qty,
      SUM(i.quantity * pv.purchase_price)::text AS total_value
    FROM inventory i
    JOIN product_variants pv ON i.variant_id = pv.id
    JOIN products p          ON pv.product_id = p.id
    LEFT JOIN brands b       ON p.brand_id    = b.id
    WHERE i.tenant_id = ${tenantId}
      AND pv.deleted_at IS NULL AND pv.is_active = true
      AND p.deleted_at  IS NULL AND p.is_active  = true
    GROUP BY b.id, b.name
    ORDER BY SUM(i.quantity * pv.purchase_price) DESC NULLS LAST
  `;

  const categoryRows = await prisma.$queryRaw<{
    category_id: number | null;
    category_name: string | null;
    total_qty: string;
    total_value: string;
  }[]>`
    SELECT
      c.id   AS category_id,
      c.name AS category_name,
      SUM(i.quantity)::text                     AS total_qty,
      SUM(i.quantity * pv.purchase_price)::text AS total_value
    FROM inventory i
    JOIN product_variants pv ON i.variant_id = pv.id
    JOIN products p          ON pv.product_id = p.id
    LEFT JOIN categories c   ON p.category_id = c.id
    WHERE i.tenant_id = ${tenantId}
      AND pv.deleted_at IS NULL AND pv.is_active = true
      AND p.deleted_at  IS NULL AND p.is_active  = true
    GROUP BY c.id, c.name
    ORDER BY SUM(i.quantity * pv.purchase_price) DESC NULLS LAST
  `;

  return {
    totalValue: parseFloat(totalRow.total_value),
    byBrand: brandRows.map((r) => ({
      brandId: r.brand_id ?? null,
      brandName: r.brand_name ?? '(No brand)',
      totalQty: parseInt(r.total_qty, 10),
      totalValue: parseFloat(r.total_value),
    })),
    byCategory: categoryRows.map((r) => ({
      categoryId: r.category_id ?? null,
      categoryName: r.category_name ?? '(No category)',
      totalQty: parseInt(r.total_qty, 10),
      totalValue: parseFloat(r.total_value),
    })),
  };
};

// ─── Movement ledger (D-02) ───────────────────────────────────────────────────

export const listMovements = async (variantId: string, query: MovementsQuery) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, deletedAt: true },
  });
  if (!variant || variant.deletedAt !== null) throw new NotFoundError('Variant');

  const { page, pageSize, skip, take } = parsePagination(query);

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { variantId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stockMovement.count({ where: { variantId } }),
  ]);

  const items = movements.map((m) => ({
    id: m.id.toString(),
    type: m.type,
    quantityDelta: m.quantityDelta,
    balanceAfter: m.balanceAfter,
    referenceType: m.referenceType,
    referenceId: m.referenceId,
    note: m.note,
    createdBy: m.createdBy,
    createdAt: m.createdAt,
  }));

  return { items, meta: buildMeta(page, pageSize, total) };
};
