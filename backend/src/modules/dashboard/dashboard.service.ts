import { prisma } from '../../db/prisma';
import { currentTenant } from '../../tenancy/context';

// ─── Stock value (qty × purchasePrice over active variants) ──────────────────

async function getStockValue(): Promise<number> {
  const tenantId = currentTenant();
  const [row] = await prisma.$queryRaw<{ total_value: string }[]>`
    SELECT COALESCE(SUM(i.quantity * pv.purchase_price), 0)::text AS total_value
    FROM inventory i
    JOIN product_variants pv ON i.variant_id = pv.id
    JOIN products p          ON pv.product_id = p.id
    WHERE i.tenant_id = ${tenantId}
      AND pv.deleted_at IS NULL AND pv.is_active = true
      AND p.deleted_at  IS NULL AND p.is_active  = true
  `;
  return parseFloat(row.total_value);
}

// ─── Summary KPIs ─────────────────────────────────────────────────────────────

export const getSummary = async () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayAgg, mtdAgg, totalSkus, openAlerts, stockValue] = await Promise.all([
    prisma.sale.aggregate({
      where: { status: 'CONFIRMED', soldAt: { gte: startOfToday } },
      _count: true,
      _sum: { grandTotal: true },
    }),
    prisma.sale.aggregate({
      where: { status: 'CONFIRMED', soldAt: { gte: startOfMonth } },
      _count: true,
      _sum: { grandTotal: true },
    }),
    prisma.productVariant.count({ where: { deletedAt: null, isActive: true } }),
    prisma.alert.count({ where: { status: 'OPEN' } }),
    getStockValue(),
  ]);

  return {
    today: {
      salesCount: todayAgg._count,
      revenue: Number(todayAgg._sum.grandTotal ?? 0),
    },
    mtd: {
      salesCount: mtdAgg._count,
      revenue: Number(mtdAgg._sum.grandTotal ?? 0),
    },
    totalSkus,
    stockValue,
    openAlerts,
  };
};

// ─── Sales trend (daily series over the last `days` days) ────────────────────

export const getSalesTrend = async (days: number) => {
  const tenantId = currentTenant();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const rows = await prisma.$queryRaw<
    { day: Date; sales_count: bigint; revenue: string }[]
  >`
    SELECT date_trunc('day', sold_at) AS day,
           COUNT(*)::bigint                  AS sales_count,
           COALESCE(SUM(grand_total), 0)::text AS revenue
    FROM sales
    WHERE tenant_id = ${tenantId} AND status = 'CONFIRMED' AND sold_at >= ${since}
    GROUP BY 1
    ORDER BY 1
  `;

  return rows.map((r) => ({
    date: r.day.toISOString().slice(0, 10),
    salesCount: Number(r.sales_count),
    revenue: parseFloat(r.revenue),
  }));
};

// ─── Top brands (by units sold, then revenue) ────────────────────────────────

export const getTopBrands = async (limit: number) => {
  const tenantId = currentTenant();
  const rows = await prisma.$queryRaw<
    { brand_id: number | null; brand_name: string | null; units: bigint; revenue: string }[]
  >`
    SELECT b.id   AS brand_id,
           b.name AS brand_name,
           COALESCE(SUM(si.quantity), 0)::bigint  AS units,
           COALESCE(SUM(si.line_total), 0)::text  AS revenue
    FROM sale_items si
    JOIN sales s             ON si.sale_id = s.id AND s.status = 'CONFIRMED'
    JOIN product_variants pv ON si.variant_id = pv.id
    JOIN products p          ON pv.product_id = p.id
    LEFT JOIN brands b       ON p.brand_id = b.id
    WHERE si.tenant_id = ${tenantId}
    GROUP BY b.id, b.name
    ORDER BY SUM(si.quantity) DESC NULLS LAST
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    brandId: r.brand_id ?? null,
    brandName: r.brand_name ?? '(No brand)',
    units: Number(r.units),
    revenue: parseFloat(r.revenue),
  }));
};

// ─── Fast-moving variants (by units sold) ────────────────────────────────────

export const getFastMoving = async (limit: number) => {
  const tenantId = currentTenant();
  const rows = await prisma.$queryRaw<
    {
      variant_id: string;
      sku: string;
      product_name: string;
      brand_name: string | null;
      units: bigint;
      revenue: string;
    }[]
  >`
    SELECT pv.id   AS variant_id,
           pv.sku  AS sku,
           p.name  AS product_name,
           b.name  AS brand_name,
           COALESCE(SUM(si.quantity), 0)::bigint  AS units,
           COALESCE(SUM(si.line_total), 0)::text  AS revenue
    FROM sale_items si
    JOIN sales s             ON si.sale_id = s.id AND s.status = 'CONFIRMED'
    JOIN product_variants pv ON si.variant_id = pv.id
    JOIN products p          ON pv.product_id = p.id
    LEFT JOIN brands b       ON p.brand_id = b.id
    WHERE si.tenant_id = ${tenantId}
    GROUP BY pv.id, pv.sku, p.name, b.name
    ORDER BY SUM(si.quantity) DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    variantId: r.variant_id,
    sku: r.sku,
    productName: r.product_name,
    brandName: r.brand_name ?? '(No brand)',
    units: Number(r.units),
    revenue: parseFloat(r.revenue),
  }));
};
