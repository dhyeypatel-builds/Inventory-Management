import { prisma } from '../../db/prisma';

/**
 * Raw tenant data exports (GDPR / backup / migration). Each entity returns a
 * flat CSV of the tenant's own rows — the tenancy extension scopes every query
 * to the requesting user's tenant automatically.
 */

export const EXPORT_ENTITIES = ['customers', 'products', 'sales', 'inventory'] as const;
export type ExportEntity = (typeof EXPORT_ENTITIES)[number];

interface CsvTable {
  filename: string;
  header: string[];
  rows: unknown[][];
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv({ header, rows }: CsvTable): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

async function customersTable(): Promise<CsvTable> {
  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  return {
    filename: 'customers.csv',
    header: ['name', 'phone', 'email', 'vat_number', 'address', 'vehicle_no', 'notes', 'created_at'],
    rows: customers.map((c) => [
      c.name, c.phone, c.email, c.vatNumber, c.address, c.vehicleNo, c.notes, c.createdAt,
    ]),
  };
}

async function productsTable(): Promise<CsvTable> {
  const variants = await prisma.productVariant.findMany({
    where: { deletedAt: null },
    include: {
      product: { include: { brand: true, category: true } },
      inventory: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return {
    filename: 'products.csv',
    header: [
      'product', 'brand', 'category', 'sku', 'barcode',
      'purchase_price', 'selling_price', 'tax_rate_pct', 'on_hand', 'active',
    ],
    rows: variants.map((v) => [
      v.product.name,
      v.product.brand?.name,
      v.product.category?.name,
      v.sku,
      v.barcode,
      Number(v.purchasePrice),
      Number(v.sellingPrice),
      Number(v.taxRatePct),
      v.inventory?.quantity ?? 0,
      v.isActive,
    ]),
  };
}

async function salesTable(): Promise<CsvTable> {
  const sales = await prisma.sale.findMany({
    include: { customer: true, items: true },
    orderBy: { soldAt: 'asc' },
  });
  const rows: unknown[][] = [];
  for (const sale of sales) {
    for (const item of sale.items) {
      rows.push([
        sale.invoiceNo,
        sale.soldAt,
        sale.status,
        sale.paymentMode,
        sale.customer?.name,
        item.description,
        item.quantity,
        Number(item.unitPrice),
        Number(item.discount),
        Number(item.taxRatePct),
        Number(item.lineTotal),
        Number(sale.grandTotal),
      ]);
    }
  }
  return {
    filename: 'sales.csv',
    header: [
      'invoice_no', 'sold_at', 'status', 'payment_mode', 'customer',
      'item', 'quantity', 'unit_price', 'discount', 'tax_rate_pct', 'line_total', 'invoice_total',
    ],
    rows,
  };
}

async function inventoryTable(): Promise<CsvTable> {
  const inventory = await prisma.inventory.findMany({
    include: { variant: { include: { product: { include: { brand: true } } } } },
  });
  return {
    filename: 'inventory.csv',
    header: ['sku', 'product', 'brand', 'quantity', 'reorder_level', 'rack_location', 'purchase_price', 'stock_value'],
    rows: inventory
      .filter((i) => i.variant.deletedAt === null)
      .map((i) => [
        i.variant.sku,
        i.variant.product.name,
        i.variant.product.brand?.name,
        i.quantity,
        i.reorderLevel,
        i.rackLocation,
        Number(i.variant.purchasePrice),
        Number(i.variant.purchasePrice) * i.quantity,
      ]),
  };
}

export async function exportEntityCsv(
  entity: ExportEntity,
): Promise<{ filename: string; csv: string }> {
  const table =
    entity === 'customers' ? await customersTable()
    : entity === 'products' ? await productsTable()
    : entity === 'sales' ? await salesTable()
    : await inventoryTable();

  return { filename: table.filename, csv: toCsv(table) };
}
